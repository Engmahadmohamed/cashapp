// Global variables
let currentUser = null;
let userData = null;

// Utility Functions
function showToast(message, type = "info", duration = 2000) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Add icon based on type
    const icon = document.createElement("i");
    switch (type) {
        case "success":
            icon.className = "fas fa-check-circle";
            break;
        case "error":
            icon.className = "fas fa-exclamation-circle";
            break;
        default:
            icon.className = "fas fa-info-circle";
    }
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toastContainer.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, duration);
}

// Authentication Functions
function checkAuthState() {
    const storedUser = localStorage.getItem("username");
    if (storedUser) {
        currentUser = storedUser;
        loadUserData();
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("navScreen").style.display = "block";
        updateUI();
        showScreen("homeScreen");
    } else {
        document.getElementById("authScreen").style.display = "block";
        document.getElementById("navScreen").style.display = "none";
    }
}

// Initialize user data in Firebase
async function initializeUserData(phoneNumber) {
    const userRef = dbRef(db, `users/${phoneNumber}`);
    const snapshot = await dbGet(userRef);
    
    if (!snapshot.exists()) {
        await dbSet(userRef, {
            phoneNumber,
            balance: 0,
            adsWatched: 0,
            todayEarnings: 0,
            totalEarned: 0,
            referralCount: 0,
            referralCode: generateReferralCode(),
            lastAdWatch: null,
            contactInfo: document.getElementById('contactInput').value || '',
            joinDate: new Date().toISOString(),
            isActive: true,
            hasJoinedChannel: false
        });
    }
}

// Login function optimization
async function login() {
    const phoneNumber = document.getElementById('usernameInput').value;
    if (!phoneNumber) {
        showToast('Please enter your phone number', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // First sign in anonymously
        await window.signInAnonymously(auth);

        // Then create/get user data
        const userRef = dbRef(db, `users/${phoneNumber}`);
        const userSnapshot = await dbGet(userRef);
        
        if (!userSnapshot.exists()) {
            // Create new user data
            await dbSet(userRef, {
                phoneNumber,
        balance: 0,
        adsWatched: 0,
                todayEarnings: 0,
                totalEarned: 0,
                referralCount: 0,
                referralCode: generateReferralCode(),
                lastAdWatch: null,
                contactInfo: document.getElementById('contactInput').value || '',
        joinDate: new Date().toISOString(),
                isActive: true,
                hasJoinedChannel: false
            });
        }

        // Set current user
        currentUser = phoneNumber;
        localStorage.setItem('currentUser', phoneNumber);

        // Show home screen immediately
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('navScreen').style.display = 'block';
        showScreen('homeScreen');

        // Show success message
        showToast('Login successful!', 'success');

        // Load data in background
        loadUserData().then(() => {
            // Show channel join modal if needed
            const userData = userSnapshot.val();
            if (!userData?.hasJoinedChannel) {
                document.getElementById('channelJoinModal').style.display = 'flex';
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
        currentUser = null;
        localStorage.removeItem('currentUser');
    } finally {
        hideLoading();
    }
}

// Update initialization to handle auth state
document.addEventListener('DOMContentLoaded', () => {
    // Set up auth state listener
    window.onAuthStateChanged(auth, async (user) => {
        console.log("Auth state changed", user);
        const savedUser = localStorage.getItem('currentUser');
        
        if (user && savedUser) {
            // User is signed in
            currentUser = savedUser;
            try {
                await loadUserData();
                document.getElementById('authScreen').style.display = 'none';
                document.getElementById('navScreen').style.display = 'block';
                showScreen('homeScreen');
            } catch (error) {
                console.error('Error loading user data:', error);
                showToast('Error loading user data', 'error');
                // Clear stored data if there's an error
                localStorage.removeItem('currentUser');
                localStorage.removeItem('authUID');
                // Show auth screen
                document.getElementById('authScreen').style.display = 'block';
                document.getElementById('navScreen').style.display = 'none';
            }
        } else {
            // No user is signed in
            currentUser = null;
            document.getElementById('authScreen').style.display = 'block';
            document.getElementById('navScreen').style.display = 'none';
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authUID');
        }
    });
});

// Update logout function
function logout() {
    auth.signOut().then(() => {
    currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authUID');
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('navScreen').style.display = 'none';
        showToast('Logged out successfully', 'success');
    }).catch((error) => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    });
}

// Optimize loadUserData function
async function loadUserData() {
    if (!currentUser) return;

    try {
        const userRef = dbRef(db, `users/${currentUser}`);
        const snapshot = await dbGet(userRef);
        userData = snapshot.val(); // Store userData globally

        if (!userData) {
            showToast('User data not found', 'error');
            return;
        }

        // Update UI elements in batch
        const updates = {
            'balance': `$${userData.balance.toFixed(2)}`,
            'todayEarnings': `$${userData.todayEarnings.toFixed(2)}`,
            'adsWatched': userData.adsWatched,
            'profileUsername': userData.phoneNumber,
            'totalEarned': `$${userData.totalEarned.toFixed(2)}`,
            'referralCount': userData.referralCount
        };

        // Apply all updates at once
        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update referral link
        const referralLink = document.getElementById("referralLink");
        if (referralLink && userData.referralCode) {
            referralLink.value = `https://t.me/Ad_Cashbot?start=${userData.referralCode}`;
        }

        // Update other UI elements
        updateReferralProgress(userData.referralCount);
        await loadHistory();

        return userData;
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('Error loading user data', 'error');
    }
}

// Update user balance
async function updateBalance(amount) {
    const userRef = dbRef(db, `users/${currentUser}`);
    const snapshot = await dbGet(userRef);
    const userData = snapshot.val();
    
    const updates = {
        balance: userData.balance + amount,
        todayEarnings: userData.todayEarnings + amount,
        totalEarned: userData.totalEarned + amount,
        adsWatched: userData.adsWatched + 1,
        lastAdWatch: Date.now()
    };
    
    await dbUpdate(userRef, updates);
    await loadUserData();
    
    // Add to history
    const historyRef = dbRef(db, `history/${currentUser}`);
    await dbPush(historyRef, {
        type: 'ad',
        amount: amount,
        timestamp: Date.now()
    });
}

// Optimize history loading
async function loadHistory() {
    const historyRef = dbRef(db, `history/${currentUser}`);
    const snapshot = await dbGet(historyRef);
    const historyData = snapshot.val() || {};
    
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    Object.values(historyData)
        .reverse()
        .slice(0, 10)
        .forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-icon ${item.type === 'ad' ? 'earn' : 'withdraw'}">
                    <i class="fas fa-${item.type === 'ad' ? 'play' : 'wallet'}"></i>
                </div>
                <div class="history-details">
                    <div class="history-title">${item.type === 'ad' ? 'Watched Ad' : 'Withdrawal'}</div>
                    <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
                <div class="history-amount ${item.type === 'ad' ? 'earn' : 'withdraw'}">
                    ${item.type === 'ad' ? '+' : '-'}$${Math.abs(item.amount).toFixed(2)}
                </div>
            `;
            fragment.appendChild(historyItem);
        });

    // Update DOM only once
    historyList.innerHTML = '';
    historyList.appendChild(fragment);
}

// UI Updates
function updateUI() {
    document.getElementById("balance").textContent = `$${userData.balance.toFixed(2)}`;
    document.getElementById("adsWatched").textContent = userData.adsWatched || 0;
    document.getElementById("todayEarnings").textContent = `$${(userData.todayEarnings || 0).toFixed(2)}`;
    updateAdCooldown();
    updateHistory();
    // Update referral link with value instead of textContent
    const referralLink = document.getElementById("referralLink");
    if (referralLink && userData && userData.referralCode) {
        referralLink.value = `https://t.me/Ad_Cashbot?start=${userData.referralCode}`;
    }
    document.getElementById("profileUsername").textContent = currentUser;
    updateReferralLink();
    updateReferralStats();
    document.getElementById("totalEarned").textContent = "$" + (userData.balance + userData.totalWithdrawn || 0).toFixed(2);
    document.getElementById("referralCount").textContent = userData.referrals || 0;
}

function updateHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    userData.history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.textContent = item;
        historyList.appendChild(div);
    });
}

// Ad Functions
async function watchAd() {
    if (!currentUser) {
        showToast('Please login first', 'error');
        return;
    }

    // Get user data from Firebase
    const userRef = dbRef(db, `users/${currentUser}`);
    const snapshot = await dbGet(userRef);
    const userData = snapshot.val();

    // Check if user has joined channel
    if (!userData.hasJoinedChannel) {
        showToast('Please join our Telegram channel first!', 'error');
        showChannelJoinModal();
        return;
    }

    // Show loading overlay
    showLoading();

    // Check cooldown
    const lastAdTime = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
    const now = new Date();
    
    // Check cooldown (changed from 30000 to 1000 milliseconds)
    if (lastAdTime && (now - lastAdTime) < 1000) { // 1 second cooldown
        hideLoading();
        showToast('Please wait 1 second between ads', 'warning');
        return;
    }

    // Initialize ad SDK
    try {
        window.show_8980914();
        
        // Update user data after successful ad view
        setTimeout(async () => {
            const updates = {
                balance: (userData.balance || 0) + 0.01,
                adsWatched: (userData.adsWatched || 0) + 1,
                lastAdWatch: now.toISOString(),
                todayEarnings: (userData.todayEarnings || 0) + 0.01,
                totalEarned: (userData.totalEarned || 0) + 0.01
            };

            // Update user data
            await dbUpdate(userRef, updates);
            
            // Add to history
            const historyRef = dbRef(db, `history/${currentUser}`);
            await dbPush(historyRef, {
                type: 'ad',
                amount: 0.01,
                timestamp: now.toISOString()
            });

            // Reload user data to update UI
            await loadUserData();

            showToast('Earned $0.01 from watching ad!', 'success');
            hideLoading();
        }, 3000);
    } catch (error) {
        console.error('Ad failed to load:', error);
        hideLoading();
        showToast('Failed to load ad. Please try again.', 'error');
    }
}

// Add cooldown timer display
function updateAdCooldown() {
    const watchAdBtn = document.querySelector('.action-button.primary');
    if (!watchAdBtn || !currentUser) return;

    const userRef = dbRef(db, `users/${currentUser}`);
    dbOnValue(userRef, (snapshot) => {
        const userData = snapshot.val();
        if (!userData) return;

        const lastAdTime = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
        const now = new Date();
        
        if (lastAdTime && (now - lastAdTime) < 1000) { // Changed from 30000 to 1000
            const remainingTime = Math.ceil((1000 - (now - lastAdTime)) / 1000);
            watchAdBtn.disabled = true;
            watchAdBtn.innerHTML = `
                <i class="fas fa-clock"></i>
                Wait ${remainingTime}s
                <small>Cooldown</small>
            `;
        } else {
            watchAdBtn.disabled = false;
            watchAdBtn.innerHTML = `
                <i class="fas fa-play"></i>
                Watch Ad
                <small>Earn $0.01 per ad</small>
            `;
        }
    });
}

// Navigation Functions
function showScreen(screenId) {
    requestAnimationFrame(() => {
        document.querySelectorAll('.sub-screen').forEach(screen => {
            screen.style.display = 'none';
        });
        const selectedScreen = document.getElementById(screenId);
        if (selectedScreen) selectedScreen.style.display = 'block';
        
        // Update navigation buttons
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const navButton = document.getElementById(`nav${screenId.replace('Screen', '')}`);
        if (navButton) navButton.classList.add('active');
    });
}

// Withdraw Functions
function showWithdrawModal() {
    document.getElementById("withdrawModal").style.display = "flex";
}

function closeWithdrawModal() {
    document.getElementById("withdrawModal").style.display = "none";
}

// Process withdrawal
async function processWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const evcNumber = document.getElementById('evcNumber').value;
    
    if (!evcNumber) {
        showToast('Please enter EVC Plus number', 'error');
        return;
    }
    
    const userRef = dbRef(db, `users/${currentUser}`);
    const snapshot = await dbGet(userRef);
    const userData = snapshot.val();
    
    if (userData.balance < amount) {
        showToast('Insufficient balance', 'error');
        return;
    }
    
    if (amount < 5) {
        showToast('Minimum withdrawal amount is $5.00', 'error');
        return;
    }
    
    // Create withdrawal request
    const withdrawalRef = dbRef(db, `withdrawals/${currentUser}`);
    await dbPush(withdrawalRef, {
        amount: amount,
        evcNumber: evcNumber,
        status: 'pending',
        timestamp: Date.now()
    });
    
    // Update user balance
    await dbUpdate(userRef, {
        balance: userData.balance - amount
    });
    
    // Add to history
    const historyRef = dbRef(db, `history/${currentUser}`);
    await dbPush(historyRef, {
        type: 'withdraw',
        amount: -amount,
        timestamp: Date.now()
    });
    
    await loadUserData();
    closeWithdrawModal();
    showToast('Withdrawal request submitted successfully', 'success');
}

// Add input validation
function validateWithdrawAmount() {
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const amountInput = document.getElementById("withdrawAmount").parentElement;
    const confirmBtn = document.querySelector('.modal-body .primary-btn');
    
    if (isNaN(amount) || amount < 5) {
        amountInput.classList.add('invalid');
        confirmBtn.disabled = true;
    } else {
        amountInput.classList.remove('invalid');
        confirmBtn.disabled = false;
    }
}

// Add event listener for amount input
document.getElementById("withdrawAmount").addEventListener('input', validateWithdrawAmount);

// Referral Functions
function updateReferralLink() {
    const referralLink = document.getElementById("referralLink");
    
    if (referralLink && userData) {
        // Use Telegram bot link with user's unique referral code instead of phone number
        const telegramBotLink = `https://t.me/Ad_Cashbot?start=${userData.referralCode}`;
        referralLink.value = telegramBotLink;
    }
}

function copyReferral() {
    const referralLink = document.getElementById("referralLink");
    referralLink.select();
    document.execCommand('copy');
    
    // Fix the toast message format
    showToast("Referral link copied!", "success");
}

function shareOnTelegram() {
    const referralLink = document.getElementById("referralLink").value;
    const text = encodeURIComponent(`Join EarnPro and earn money by watching ads! 💰\n\nUse my referral link to get started:\n${referralLink}`);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    window.open(telegramUrl, '_blank');
}

function shareOnWhatsApp() {
    const referralLink = document.getElementById("referralLink").value;
    const text = encodeURIComponent(`Join EarnPro and earn money by watching ads! 💰\n\nUse my referral link to get started:\n${referralLink}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, '_blank');
}

function updateReferralStats() {
    document.getElementById("totalReferrals").textContent = userData.referrals || 0;
    document.getElementById("referralEarnings").textContent = 
        "$" + ((userData.referrals || 0) * 0.05).toFixed(2);
}

// Add this function to check channel membership
function checkChannelMembership() {
    if (!userData.hasJoinedChannel) {
        showChannelJoinModal();
    }
}

// Add this function to check for referral code on login/signup
function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (referralCode) {
        const allUsers = getAllUsers();
        const referrer = allUsers.find(user => user.referralCode === referralCode);
        
        if (referrer && referrer.username !== currentUser) {
            const referrerData = JSON.parse(localStorage.getItem(`userData_${referrer.username}`));
            
            // Check referral limit
            if (referrerData.referrals >= 5) {
                showToast({
                    message: "Referrer has reached maximum referral limit",
                    type: "error"
                });
                return;
            }
            
            // Initialize referral tracking arrays if they don't exist
            if (!referrerData.referredUsers) {
                referrerData.referredUsers = [];
            }
            
            // Check if this user hasn't been counted as a referral before
            if (!referrerData.referredUsers.includes(currentUser)) {
                // Add referral bonus
                referrerData.referrals = (referrerData.referrals || 0) + 1;
                referrerData.balance += 0.05; // Referral bonus
                referrerData.referredUsers.push(currentUser);
                referrerData.lastReferralDate = new Date().toISOString();
                
                // Add to history
                const timestamp = new Date().toLocaleString();
                referrerData.history.push(`Earned $0.05 from referral: ${currentUser} at ${timestamp}`);
                
                // Save referrer's data
                localStorage.setItem(`userData_${referrer.username}`, JSON.stringify(referrerData));
                
                // Mark current user as referred
                userData.referredBy = referrer.username;
                saveUserData();
                
                showToast({
                    message: "Welcome! You were referred by " + referrer.username,
                    type: "success"
                });
            }
        }
    }
}

// Generate a unique referral code
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        // Show home screen immediately
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('navScreen').style.display = 'block';
        showScreen('homeScreen');
        
        // Load data in background
        loadUserData().catch(error => {
            console.error('Error loading user data:', error);
            showToast('Error loading user data', 'error');
        });
    }
});

function showChannelJoinModal() {
    const modal = document.getElementById("channelJoinModal");
    modal.style.display = "flex";
}

async function verifyChannelJoin() {
    if (!currentUser) {
        showToast('Please login first', 'error');
        return;
    }

    const userRef = dbRef(db, `users/${currentUser}`);
    
    try {
        await dbUpdate(userRef, {
            hasJoinedChannel: true,
            channelJoinDate: new Date().toISOString()
        });
        
        document.getElementById('channelJoinModal').style.display = 'none';
        showToast('Thank you for joining our channel!', 'success');
    } catch (error) {
        console.error('Error updating channel join status:', error);
        showToast('Error verifying channel join. Please try again.', 'error');
    }
}

// Add cooldown timer interval
setInterval(updateAdCooldown, 1000); 

// Show/Hide loading overlay
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Add this function after the loadUserData function
function updateReferralProgress(referralCount) {
    const progress = document.getElementById('referralProgress');
    const currentReferrals = document.getElementById('currentReferrals');
    const maxReferrals = 5; // Maximum number of referrals
    
    if (progress && currentReferrals) {
        // Calculate percentage (max 100%)
        const percentage = Math.min((referralCount / maxReferrals) * 100, 100);
        
        // Update progress bar width
        progress.style.width = `${percentage}%`;
        
        // Update current referrals text
        currentReferrals.textContent = referralCount;
    }
}