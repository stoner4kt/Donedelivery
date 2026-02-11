// Authentication Module
let currentUser = null;

// Initialize auth state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await updateUserProfile(user);
        showAuthenticatedUI();
    } else {
        currentUser = null;
        showUnauthenticatedUI();
    }
});

// Update user profile display
async function updateUserProfile(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (userData) {
            const displayName = userData.firstName + ' ' + userData.lastName;
            document.getElementById('userNameDisplay').textContent = displayName;
        } else {
            document.getElementById('userNameDisplay').textContent = user.displayName || user.email.split('@')[0];
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        document.getElementById('userNameDisplay').textContent = user.email.split('@')[0];
    }
}

// Show authenticated UI
function showAuthenticatedUI() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('userAccountBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
}

// Show unauthenticated UI
function showUnauthenticatedUI() {
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('userAccountBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

// Email/Password Login
async function loginWithEmail(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        closeModal('loginModal');
        showAlert('Login successful!', 'success');
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
}

// Email/Password Signup
async function signupWithEmail(userData) {
    try {
        // Validate passwords match
        if (userData.password !== userData.confirmPassword) {
            throw new Error('Passwords do not match');
        }

        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(
            userData.email,
            userData.password
        );

        const user = userCredential.user;

        // Update profile
        await user.updateProfile({
            displayName: `${userData.firstName} ${userData.lastName}`
        });

        // Save additional user data to Firestore
        await db.collection('users').doc(user.uid).set({
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            whatsapp: userData.whatsapp,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            role: 'customer'
        });

        closeModal('loginModal');
        showAlert('Account created successfully!', 'success');
        return user;
    } catch (error) {
        console.error('Signup error:', error);
        throw new Error(getAuthErrorMessage(error.code) || error.message);
    }
}

// Google Sign In
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Check if user document exists
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (!userDoc.exists) {
            // First time Google sign-in, create user document
            const nameParts = user.displayName ? user.displayName.split(' ') : ['', ''];
            await db.collection('users').doc(user.uid).set({
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                email: user.email,
                phone: '', // Will need to be updated by user
                whatsapp: '', // Will need to be updated by user
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'customer',
                photoURL: user.photoURL
            });

            // Prompt user to complete profile
            showAlert('Please complete your profile with phone numbers', 'info');
        }

        closeModal('loginModal');
        showAlert('Login successful!', 'success');
        return user;
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            throw new Error(getAuthErrorMessage(error.code));
        }
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        showAlert('Logged out successfully', 'success');
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        showAlert('Error logging out', 'error');
    }
}

// Get user-friendly error messages
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/operation-not-allowed': 'Operation not allowed',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/too-many-requests': 'Too many attempts. Please try again later',
        'auth/network-request-failed': 'Network error. Please check your connection'
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again';
}

// Check if user is authenticated
function requireAuth(callback) {
    if (!currentUser) {
        showAlert('Please login to continue', 'info');
        openModal('loginModal');
        return false;
    }
    if (callback) callback();
    return true;
}

// Get current user data
async function getCurrentUserData() {
    if (!currentUser) return null;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        return userDoc.data();
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// Update user profile
async function updateUserProfile(updates) {
    if (!currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            ...updates,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showAlert('Profile updated successfully', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Error updating profile', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login button
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        openModal('loginModal');
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // Auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show/hide forms
            document.getElementById('loginForm').style.display = tabName === 'login' ? 'block' : 'none';
            document.getElementById('signupForm').style.display = tabName === 'signup' ? 'block' : 'none';
        });
    });

    // Login form submission
    document.getElementById('loginSubmitBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showAlert('Please fill in all fields', 'error');
            return;
        }

        try {
            showLoading('loginSubmitBtn');
            await loginWithEmail(email, password);
        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            hideLoading('loginSubmitBtn', 'Login');
        }
    });

    // Signup form submission
    document.getElementById('signupSubmitBtn')?.addEventListener('click', async () => {
        const userData = {
            firstName: document.getElementById('signupFirstName').value.trim(),
            lastName: document.getElementById('signupLastName').value.trim(),
            email: document.getElementById('signupEmail').value.trim(),
            phone: document.getElementById('signupPhone').value.trim(),
            whatsapp: document.getElementById('signupWhatsApp').value.trim(),
            password: document.getElementById('signupPassword').value,
            confirmPassword: document.getElementById('signupConfirmPassword').value
        };

        // Validate all fields
        if (!userData.firstName || !userData.lastName || !userData.email || 
            !userData.phone || !userData.whatsapp || !userData.password) {
            showAlert('Please fill in all fields', 'error');
            return;
        }

        try {
            showLoading('signupSubmitBtn');
            await signupWithEmail(userData);
        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            hideLoading('signupSubmitBtn', 'Create Account');
        }
    });

    // Google login buttons
    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    });

    document.getElementById('googleSignupBtn')?.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            showAlert(error.message, 'error');
        }
    });
});

// Helper function to show loading state
function showLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="spinner"></div>';
    }
}

// Helper function to hide loading state
function hideLoading(buttonId, originalText) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = false;
        button.textContent = originalText;
    }
}
