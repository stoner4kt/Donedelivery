// Parcel Management Module

/**
 * NEW: Syncs parcel data to Google Sheets via Cloud Function
 */
async function saveToGoogleSheets(parcel, parcelId) {
    try {
        console.log('Initiating background sync to Google Sheets...');
        // We use the CLOUD_FUNCTION_URL defined in config.js
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'saveToSheet',
                parcelId: parcelId,
                trackingNumber: parcel.trackingNumber,
                sender: parcel.sender.name,
                receiver: parcel.receiver.name,
                amount: parcel.pricing.totalAmount,
                status: parcel.status
            })
        });
        
        if (!response.ok) throw new Error('Cloud sync request failed');
        console.log('✅ Google Sheets sync successful');
    } catch (error) {
        console.error('❌ Sheet Sync Error:', error);
        // We don't block the UI here since the data is safely in Firestore
    }
}

/**
 * Creates a new parcel in Firestore and triggers backend sync
 */
async function createParcel(parcelData) {
    try {
        if (!currentUser) {
            throw new Error('You must be logged in to create a shipment');
        }

        const trackingNumber = generateTrackingNumber();

        const parcel = {
            trackingNumber,
            userId: currentUser.uid,
            sender: {
                name: parcelData.senderName,
                phone: parcelData.senderPhone,
                email: parcelData.senderEmail,
                whatsapp: parcelData.senderWhatsApp,
                address: parcelData.senderAddress
            },
            receiver: {
                name: parcelData.receiverName,
                phone: parcelData.receiverPhone,
                email: parcelData.receiverEmail,
                whatsapp: parcelData.receiverWhatsApp,
                address: parcelData.receiverAddress
            },
            package: {
                description: parcelData.packageDescription,
                weight: parseFloat(parcelData.packageWeight),
                value: parseFloat(parcelData.packageValue),
                distance: parseFloat(parcelData.estimatedDistance)
            },
            pricing: {
                basePrice: calculatePrice(parseFloat(parcelData.estimatedDistance)),
                totalAmount: calculatePrice(parseFloat(parcelData.estimatedDistance))
            },
            status: PARCEL_STATUS.PENDING,
            payment: {
                status: 'unpaid',
                method: 'paystack'
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // 1. Save to Firebase Firestore
        const docRef = await db.collection('parcels').add(parcel);
        console.log('Parcel saved to DB with ID:', docRef.id);
        
        // 2. Trigger the Cloud Function sync
        // We run this without 'await' so the user isn't kept waiting for the payment screen
        saveToGoogleSheets(parcel, docRef.id);

        return { id: docRef.id, trackingNumber, totalAmount: parcel.pricing.totalAmount };
    } catch (error) {
        console.error('Error creating parcel:', error);
        throw error;
    }
}

// Event listener for the parcel form
document.getElementById('parcelForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const parcelData = {
        senderName: document.getElementById('senderName').value,
        senderPhone: document.getElementById('senderPhone').value,
        senderEmail: document.getElementById('senderEmail').value,
        senderWhatsApp: document.getElementById('senderWhatsApp').value,
        senderAddress: document.getElementById('senderAddress').value,
        receiverName: document.getElementById('receiverName').value,
        receiverPhone: document.getElementById('receiverPhone').value,
        receiverEmail: document.getElementById('receiverEmail').value,
        receiverWhatsApp: document.getElementById('receiverWhatsApp').value,
        receiverAddress: document.getElementById('receiverAddress').value,
        packageDescription: document.getElementById('packageDescription').value,
        packageWeight: document.getElementById('packageWeight').value,
        packageValue: document.getElementById('packageValue').value,
        estimatedDistance: document.getElementById('estimatedDistance').value
    };

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating shipment...';

        const result = await createParcel(parcelData);
        closeModal('parcelModal');
        initializePayment(result.id, result.trackingNumber, result.totalAmount);

    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to Payment';
    }
});