# Quick Start Guide - Done Delivery

## Get Your Website Running in 30 Minutes!

### Step 1: Firebase Setup (10 minutes)

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com/
   - Click "Add project"
   - Name it "Done Delivery"
   - Disable Google Analytics (you can enable later)
   - Click "Create project"

2. **Add Web App**
   - Click the web icon (</>) 
   - Register app as "Done Delivery Web"
   - Copy the config values shown

3. **Enable Authentication**
   - Go to Authentication → Get Started
   - Enable "Email/Password"
   - Enable "Google"

4. **Create Firestore Database**
   - Go to Firestore Database → Create database
   - Start in production mode
   - Choose location: europe-west1
   - Click "Enable"

5. **Enable Storage**
   - Go to Storage → Get started
   - Start in production mode
   - Click "Done"

6. **Upgrade to Blaze Plan**
   - Go to Project Settings → Usage and billing
   - Click "Modify plan"
   - Select Blaze (pay as you go)
   - Don't worry - it's free for small usage!

### Step 2: Configure Your Files (5 minutes)

1. **Update config.js**
   - Open `config.js` in a text editor
   - Replace the Firebase configuration with your values from Step 1
   - Save the file

2. **Get Paystack Key**
   - Sign up at https://paystack.com/
   - Go to Settings → API Keys
   - Copy your Public Key (pk_test_...)
   - Update `config.js` with your Paystack key

### Step 3: Upload to Your Hosting (10 minutes)

1. **Access cPanel**
   - Log in to your cPanel account
   - Go to File Manager
   - Navigate to `public_html`

2. **Upload Files**
   - Click "Upload"
   - Select all files from the done-delivery folder
   - Wait for upload to complete

3. **Set Permissions**
   - Select all files
   - Right-click → Change Permissions
   - Set to 644 for files, 755 for folders

4. **Enable SSL**
   - Go back to cPanel home
   - Find "SSL/TLS Status"
   - Enable AutoSSL for your domain

### Step 4: Create First Admin (5 minutes)

1. **Go to Firebase Console**
   - Navigate to Authentication
   - Click "Add user"
   - Email: admin@donedelivery.co.za
   - Set a strong password
   - Copy the User UID

2. **Create User Document**
   - Go to Firestore Database
   - Click "Start collection"
   - Collection ID: users
   - Document ID: [paste the User UID]
   - Add fields:
     - firstName: "Admin"
     - lastName: "User"
     - email: "admin@donedelivery.co.za"
     - phone: "0810606488"
     - whatsapp: "27810606488"
     - role: "admin"
   - Click "Save"

### Step 5: Test Your Site! (5 minutes)

1. **Visit Your Website**
   - Open https://www.yourdomain.co.za
   - You should see the Done Delivery homepage

2. **Test Registration**
   - Click "Login"
   - Switch to "Sign Up"
   - Create a test account
   - Verify you can log in

3. **Test Creating a Parcel**
   - Click "Ship Now"
   - Fill in the form
   - Use test distance: 10 km
   - Total should show R800.00

4. **Test Payment**
   - When payment modal opens
   - Use Paystack test card:
     - Card: 4084 0840 8408 4081
     - CVV: 408
     - Expiry: 12/28
     - PIN: 0000
     - OTP: 123456

5. **Check Label Generation**
   - After payment, labels should auto-download
   - You should see a tracking number

### Done! 🎉

Your courier website is now live!

## What's Next?

### Essential (Do These Soon)

1. **Set Up Security Rules**
   - Copy security rules from README.md
   - Paste in Firebase Console → Firestore → Rules
   - Publish

2. **Enable Notifications**
   - Sign up for WhatsApp Business API
   - Configure SMS provider
   - Update config.js with credentials

3. **Create Driver Accounts**
   - In Firebase Authentication, add driver users
   - In Firestore, set their role to "driver"
   - Share driver.html URL with them

### Optional (Nice to Have)

1. **Google Sheets Integration**
   - Set up for permanent data storage
   - Follow instructions in DEPLOYMENT.md

2. **Email Notifications**
   - Set up SendGrid or similar
   - Configure in Firebase Cloud Functions

3. **Custom Domain Email**
   - Set up info@donedelivery.co.za
   - Update contact information

## Common Issues & Solutions

**Issue**: Can't log in after deployment
**Solution**: Check that you've enabled Email/Password in Firebase Authentication

**Issue**: Payment fails
**Solution**: Make sure you're using the test card details exactly as shown

**Issue**: Labels not generating
**Solution**: Check browser console for errors, ensure jsPDF and JsBarcode are loading

**Issue**: Images not uploading
**Solution**: Verify Firebase Storage is enabled and rules are set

**Issue**: Site shows 404 error
**Solution**: Make sure index.html is in the root of public_html

## Need Help?

1. Check the full README.md for detailed documentation
2. Read DEPLOYMENT.md for comprehensive setup guide
3. Contact support: info@donedelivery.co.za

## Security Reminder

Before going live:
- [ ] Change admin password
- [ ] Update Paystack to live key (pk_live_)
- [ ] Set up proper security rules
- [ ] Enable SSL certificate
- [ ] Test all features thoroughly

---

**Congratulations!** You now have a fully functional courier delivery platform! 🚚📦
