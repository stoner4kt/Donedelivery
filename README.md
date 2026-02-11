# Done Delivery - Courier Management System

A complete courier delivery platform with real-time tracking, payment processing, WhatsApp integration, and mobile driver dashboard.

## Features

### Customer Features
- ✅ User authentication (Email/Password & Google Sign-In)
- ✅ Create shipping orders with full sender/receiver details
- ✅ Secure payment processing via Paystack
- ✅ Real-time parcel tracking
- ✅ Automated PDF label generation with barcodes
- ✅ WhatsApp, SMS, and Email notifications
- ✅ Track parcels via website or WhatsApp bot
- ✅ View delivery proof with uploaded photos

### Driver Features  
- ✅ Mobile-optimized driver dashboard
- ✅ Real-time parcel assignment
- ✅ Update parcel status (Pickup, In Transit, Delivered)
- ✅ Upload proof of delivery photos
- ✅ Barcode scanning for quick parcel lookup
- ✅ Contact sender/receiver directly

### Business Features
- ✅ Firebase Firestore for real-time data
- ✅ 30-day data retention in Firestore
- ✅ Permanent data storage in Google Sheets
- ✅ Automated status notifications
- ✅ Payment verification and tracking
- ✅ Distance-based pricing (R80/km)

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Payments**: Paystack
- **PDF Generation**: jsPDF
- **Barcode Generation**: JsBarcode
- **Hosting**: cPanel (domain.co.za)

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "Done Delivery"
3. Enable the following services:
   - **Authentication**: Email/Password and Google providers
   - **Firestore Database**: Start in production mode
   - **Storage**: Start in production mode
4. Upgrade to Firebase Blaze plan (pay-as-you-go)

#### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Parcels collection
    match /parcels/{parcelId} {
      // Allow users to read their own parcels
      allow read: if request.auth != null && 
                    (resource.data.userId == request.auth.uid || 
                     resource.data.driver == request.auth.uid ||
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'driver']);
      
      // Allow authenticated users to create parcels
      allow create: if request.auth != null;
      
      // Allow drivers and admins to update parcels
      allow update: if request.auth != null && 
                      (resource.data.driver == request.auth.uid || 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'driver']);
      
      // Only admins can delete
      allow delete: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

#### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /proof-of-delivery/{parcelId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    match /labels/{parcelId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### 2. Firebase Configuration

Edit `config.js` and replace the Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Get these values from:
Firebase Console → Project Settings → Your apps → Web app

### 3. Paystack Setup

1. Sign up at [Paystack](https://paystack.com/)
2. Get your **Public Key** from Settings → API Keys & Webhooks
3. Update `config.js`:

```javascript
const PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxx"; // Use pk_live_ for production
```

### 4. WhatsApp Business API Setup

For WhatsApp notifications, you need:

1. WhatsApp Business Account
2. WhatsApp Business API access (e.g., via Twilio, MessageBird, or direct)
3. Update `config.js` with your API endpoint:

```javascript
const WHATSAPP_API_URL = "YOUR_WHATSAPP_API_ENDPOINT";
```

Implement the WhatsApp sending function in `parcel.js`:

```javascript
async function sendWhatsAppMessage(phoneNumber, message) {
    const response = await fetch(WHATSAPP_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_TOKEN'
        },
        body: JSON.stringify({
            to: phoneNumber,
            message: message
        })
    });
    return await response.json();
}
```

### 5. SMS Integration (Optional)

For SMS notifications via services like Twilio, ClickSend, or AfricasTalking:

```javascript
async function sendSMS(phoneNumber, message) {
    // Example with ClickSend
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa('USERNAME:API_KEY')
        },
        body: JSON.stringify({
            messages: [{
                to: phoneNumber,
                body: message,
                from: 'DoneDelivery'
            }]
        })
    });
    return await response.json();
}
```

### 6. Google Sheets Integration

For permanent data storage:

1. Create a Google Sheet
2. Use Google Apps Script or Firebase Cloud Functions
3. Set up webhook to append data

Example Cloud Function:

```javascript
exports.saveToSheets = functions.firestore
    .document('parcels/{parcelId}')
    .onCreate(async (snap, context) => {
        const parcel = snap.data();
        // Append to Google Sheets using Google Sheets API
    });
```

### 7. cPanel Hosting Setup

1. **Upload Files**:
   - Upload all files to `public_html` directory
   - Ensure `index.html` is in the root

2. **SSL Certificate**:
   - Enable AutoSSL in cPanel
   - Or use Let's Encrypt

3. **File Permissions**:
   ```
   Files: 644
   Directories: 755
   ```

4. **.htaccess Configuration**:

Create `.htaccess` file:

```apache
# Enable HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

### 8. Create Admin/Driver Accounts

After deployment, manually create admin/driver users in Firestore:

```javascript
// In Firestore console, create a user document:
{
    firstName: "John",
    lastName: "Driver",
    email: "driver@donedelivery.co.za",
    phone: "0810606488",
    whatsapp: "27810606488",
    role: "driver",  // or "admin"
    createdAt: timestamp
}
```

Then in Firebase Authentication, create matching account.

### 9. Testing

1. **Test Customer Flow**:
   - Register new account
   - Create shipment
   - Process payment (use Paystack test cards)
   - Track parcel

2. **Test Driver Flow**:
   - Login as driver
   - View assigned parcels
   - Update status
   - Upload proof of delivery

3. **Test Notifications**:
   - Verify WhatsApp messages
   - Check email notifications
   - Confirm SMS delivery

### 10. Production Checklist

- [ ] Replace Paystack test key with live key
- [ ] Update Firebase to production security rules
- [ ] Configure email sending (SendGrid, etc.)
- [ ] Set up WhatsApp Business API
- [ ] Configure SMS provider
- [ ] Set up Google Sheets integration
- [ ] Enable analytics (Firebase Analytics)
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Create backup strategy
- [ ] Configure domain DNS properly
- [ ] Enable SSL certificate
- [ ] Test all features end-to-end

## File Structure

```
done-delivery/
├── index.html              # Main landing page
├── driver.html             # Driver dashboard
├── style.css               # Global styles
├── config.js               # Firebase & API configuration
├── auth.js                 # Authentication logic
├── parcel.js               # Parcel management
├── tracking.js             # Tracking functionality
├── payment.js              # Payment processing
├── labels.js               # PDF label generation
├── driver.js               # Driver dashboard logic
├── script.js               # General UI functions
├── .htaccess               # Apache configuration
└── assets/                 # Images and assets
```

## API Keys Required

1. **Firebase** (Free tier available, Blaze plan for production)
2. **Paystack** (Free, transaction fees apply)
3. **WhatsApp Business API** (Varies by provider)
4. **SMS Provider** (Optional, varies by provider)
5. **Google Sheets API** (Free)

## Support

For issues or questions:
- Email: info@donedelivery.co.za
- Phone: 081 0606 488
- WhatsApp: +27 81 0606 488

## License

Proprietary - All rights reserved © 2026 Done Delivery
