# Deployment Guide - Done Delivery

## Pre-Deployment Checklist

### 1. Obtain Required API Keys

#### Firebase (Required)
1. Go to https://console.firebase.google.com/
2. Create new project: "Done Delivery"
3. Add a web app to your project
4. Copy configuration values (apiKey, authDomain, projectId, etc.)
5. Upgrade to Blaze plan (required for Cloud Functions and external API calls)

#### Paystack (Required)
1. Sign up at https://paystack.com/
2. Complete business verification
3. Navigate to Settings → API Keys & Webhooks
4. Copy your Public Key (starts with pk_test_ or pk_live_)
5. For production, request to go live and get pk_live_ key

#### WhatsApp Business API (Required)
**Option 1: Using Twilio**
1. Sign up at https://www.twilio.com/whatsapp
2. Set up WhatsApp sandbox for testing
3. Get Account SID and Auth Token
4. For production, apply for WhatsApp Business API access

**Option 2: Using 360Dialog**
1. Sign up at https://hub.360dialog.com/
2. Complete setup wizard
3. Get API key
4. Connect your WhatsApp Business number

**Option 3: Using MessageBird**
1. Sign up at https://www.messagebird.com/
2. Set up WhatsApp Business
3. Get API key

#### SMS Provider (Optional but Recommended)
**Option 1: Twilio**
1. Same account as WhatsApp
2. Get phone number
3. Use Account SID and Auth Token

**Option 2: ClickSend**
1. Sign up at https://www.clicksend.com/
2. Purchase SMS credits
3. Get API credentials

**Option 3: Africa's Talking**
1. Sign up at https://africastalking.com/
2. Better rates for South African numbers
3. Get API key and username

### 2. Configure Firebase

#### Authentication Setup
1. In Firebase Console → Authentication
2. Click "Get Started"
3. Enable Email/Password provider
4. Enable Google provider:
   - Add your domain to authorized domains
   - Add your cPanel domain (yourdomain.co.za)

#### Firestore Setup
1. In Firebase Console → Firestore Database
2. Click "Create database"
3. Start in **Production mode**
4. Choose location: europe-west1 (closest to South Africa)
5. Create collections:
   - `users`
   - `parcels`

6. Set up security rules (from README.md)

#### Storage Setup
1. In Firebase Console → Storage
2. Click "Get Started"
3. Start in **Production mode**
4. Create folders:
   - `proof-of-delivery/`
   - `labels/`

5. Set up security rules (from README.md)

### 3. Update Configuration Files

#### Update config.js

```javascript
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSy...",  // Your actual API key
    authDomain: "done-delivery-xxxxx.firebaseapp.com",
    projectId: "done-delivery-xxxxx",
    storageBucket: "done-delivery-xxxxx.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:xxxxx"
};

// Paystack Configuration
const PAYSTACK_PUBLIC_KEY = "pk_live_xxxxx"; // Use live key for production

// WhatsApp Configuration
const WHATSAPP_API_URL = "https://api.your-provider.com/v1/messages";
const WHATSAPP_API_TOKEN = "your_api_token";
```

### 4. Set Up Email Notifications

**Option 1: Using SendGrid (Recommended)**
1. Sign up at https://sendgrid.com/
2. Create API key
3. Verify sender identity
4. Set up Firebase Cloud Function:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendEmail = functions.https.onCall(async (data, context) => {
    const msg = {
        to: data.to,
        from: 'noreply@donedelivery.co.za',
        subject: data.subject,
        text: data.message,
        html: data.message
    };
    
    await sgMail.send(msg);
    return { success: true };
});
```

**Option 2: Using Firebase Extensions**
1. Install "Trigger Email" extension
2. Configure SMTP settings
3. Use your domain's email

### 5. Set Up Google Sheets Integration

1. Create a Google Sheet named "Done Delivery - Parcels"
2. Set up columns:
   - Tracking Number
   - Sender Name
   - Receiver Name
   - Amount
   - Status
   - Created Date
   - Delivered Date

3. Get Sheet ID from URL
4. Enable Google Sheets API in Google Cloud Console
5. Create service account and download credentials
6. Share sheet with service account email

7. Create Firebase Cloud Function:

```javascript
const { google } = require('googleapis');

exports.saveToSheets = functions.firestore
    .document('parcels/{parcelId}')
    .onCreate(async (snap, context) => {
        const parcel = snap.data();
        
        const auth = new google.auth.GoogleAuth({
            keyFile: 'service-account-key.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: 'YOUR_SHEET_ID',
            range: 'Sheet1!A:G',
            valueInputOption: 'RAW',
            resource: {
                values: [[
                    parcel.trackingNumber,
                    parcel.sender.name,
                    parcel.receiver.name,
                    parcel.pricing.totalAmount,
                    parcel.status,
                    new Date(parcel.createdAt).toISOString(),
                    ''
                ]]
            }
        });
    });
```

### 6. cPanel Hosting Deployment

#### Prepare Files
1. Download all files to your computer
2. Update all configuration values
3. Test locally if possible

#### Upload to cPanel
1. Log in to your cPanel account
2. Go to File Manager
3. Navigate to `public_html`
4. Upload all files:
   - index.html
   - driver.html
   - All .js files
   - style.css
   - .htaccess
   - assets folder

#### File Permissions
```bash
# Set correct permissions
Files: 644
Directories: 755
```

In File Manager:
- Right-click files → Change Permissions → 644
- Right-click folders → Change Permissions → 755

#### SSL Certificate
1. In cPanel → SSL/TLS Status
2. Enable AutoSSL for your domain
3. Wait 5-10 minutes for certificate to be issued
4. Verify HTTPS is working

#### Domain Configuration
1. Ensure domain DNS is pointed to your cPanel server
2. In cPanel → Domains
3. Verify domain is listed and active

### 7. Create Initial Users

#### Create Admin User
1. Go to Firebase Console → Authentication
2. Add user manually:
   - Email: admin@donedelivery.co.za
   - Password: (strong password)
3. Copy User UID
4. Go to Firestore → users collection
5. Create document with UID as ID:

```json
{
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@donedelivery.co.za",
    "phone": "0810606488",
    "whatsapp": "27810606488",
    "role": "admin",
    "createdAt": [current timestamp]
}
```

#### Create Driver Users
Same process but with `role: "driver"`

### 8. Testing Phase

#### Test Customer Journey
1. Register new account
2. Create test shipment
3. Use Paystack test card:
   - Card: 4084 0840 8408 4081
   - CVV: 408
   - Expiry: 12/28
   - PIN: 0000
   - OTP: 123456
4. Verify notifications sent
5. Track parcel
6. Check labels generated

#### Test Driver Journey
1. Login as driver
2. Verify parcels appear
3. Update status
4. Upload test image
5. Verify notifications sent

#### Test WhatsApp Bot
1. Send message to business WhatsApp
2. Test tracking command
3. Test pricing inquiry
4. Test handoff to human

### 9. Go Live Checklist

- [ ] All API keys updated to production
- [ ] Paystack live key activated
- [ ] WhatsApp Business approved
- [ ] Email sending verified
- [ ] SSL certificate active
- [ ] Domain accessible via HTTPS
- [ ] Test transactions completed successfully
- [ ] Backup strategy in place
- [ ] Error monitoring configured
- [ ] Admin access confirmed
- [ ] Driver accounts created
- [ ] Contact information updated
- [ ] Terms & privacy policy added

### 10. Monitoring & Maintenance

#### Daily
- Check Firebase quota usage
- Review new orders
- Monitor payment status

#### Weekly
- Review error logs
- Check notification delivery rates
- Verify Google Sheets sync

#### Monthly
- Audit user accounts
- Review costs and usage
- Update security rules if needed
- Clean up expired data (automated via Cloud Function)

## Troubleshooting

### Common Issues

**1. Firebase Authentication Not Working**
- Check domain is in authorized domains list
- Verify API key is correct
- Check browser console for errors

**2. Paystack Payment Failing**
- Verify public key is correct
- Check Paystack dashboard for errors
- Ensure test mode vs live mode is correct

**3. Notifications Not Sending**
- Verify API credentials
- Check Firebase Functions logs
- Test API endpoints manually

**4. Images Not Uploading**
- Check Storage security rules
- Verify CORS configuration
- Check file size limits

**5. SSL Issues**
- Clear browser cache
- Wait for SSL propagation (up to 24 hours)
- Check mixed content warnings

## Support Contacts

**Firebase**: https://firebase.google.com/support
**Paystack**: support@paystack.com
**Your hosting provider**: support@yourhostingprovider.com

## Emergency Procedures

### If Site Goes Down
1. Check cPanel service status
2. Verify domain DNS
3. Check SSL certificate
4. Review error logs in cPanel

### If Payments Failing
1. Check Paystack dashboard
2. Verify API key
3. Contact Paystack support
4. Temporarily disable new orders

### If Database Issues
1. Check Firebase quota
2. Review Firestore rules
3. Check for rate limiting
4. Contact Firebase support

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Production URL**: https://www.donedelivery.co.za
**Version**: 1.0.0
