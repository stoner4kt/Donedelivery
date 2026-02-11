// Firebase Configuration
// IM   PORTANT: Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyA_Rcqh0iNCwkG8DnDaUufj-un6GKbB2SE",
    authDomain: "donedelivery-9770f.firebaseapp.com",
    projectId: "donedelivery-9770f",
    storageBucket: "donedelivery-9770f.firebasestorage.app",
    messagingSenderId: "821373082835",
    appId: "1:821373082835:web:15a3cd858dc25b3fd78826",
    measurementId: "G-PQN5HRM08T"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Paystack Configuration
const PAYSTACK_PUBLIC_KEY = "pk_test_c57874d79609a9b27af019c27b59247e1b6d42d4"; // Replace with your Paystack public key

// WhatsApp Configuration
const WHATSAPP_NUMBER = "27810606488"; // Business WhatsApp number
const WHATSAPP_API_URL = "YOUR_WHATSAPP_API_ENDPOINT"; // Your WhatsApp Business API endpoint

// Google Sheets Configuration (for permanent storage)
const GOOGLE_SHEETS_API_KEY = "YOUR_GOOGLE_SHEETS_API_KEY";
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";

// Business Configuration
const BUSINESS_CONFIG = {
    serviceArea: "Makhado, Limpopo",
    pricePerKm: 80,
    currency: "ZAR",
    businessName: "Done Delivery",
    businessPhone: "081 0606 488",
    businessEmail: "info@donedelivery.co.za",
    businessAddress: "Makhado, Limpopo, South Africa"
};

// Status definitions
const PARCEL_STATUS = {
    PENDING: 'pending',
    PICKED_UP: 'picked-up',
    IN_TRANSIT: 'in-transit',
    DELIVERED: 'delivered'
};

// Helper function to generate tracking number
function generateTrackingNumber() {
    const prefix = 'DN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

// Helper function to calculate price
function calculatePrice(distance) {
    return distance * BUSINESS_CONFIG.pricePerKm;
}

// Helper function to format currency
function formatCurrency(amount) {
    return `R${amount.toFixed(2)}`;
}

// Helper function to format date
function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate();
    return d.toLocaleString('en-ZA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Export configurations
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        auth,
        db,
        storage,
        PAYSTACK_PUBLIC_KEY,
        WHATSAPP_NUMBER,
        WHATSAPP_API_URL,
        BUSINESS_CONFIG,
        PARCEL_STATUS,
        generateTrackingNumber,
        calculatePrice,
        formatCurrency,
        formatDate
    };
}
