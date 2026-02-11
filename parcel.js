// Parcel Management Module

// Create new parcel
async function createParcel(parcelData) {
    try {
        if (!currentUser) {
            throw new Error('You must be logged in to create a shipment');
        }

        // Generate tracking number
        const trackingNumber = generateTrackingNumber();

        // Prepare parcel document
        const parcel = {
            trackingNumber,
            userId: currentUser.uid,
            
            // Sender information
            sender: {
                name: parcelData.senderName,
                phone: parcelData.senderPhone,
                email: parcelData.senderEmail,
                whatsapp: parcelData.senderWhatsApp,
                address: parcelData.senderAddress
            },
            
            // Receiver information
            receiver: {
                name: parcelData.receiverName,
                phone: parcelData.receiverPhone,
                email: parcelData.receiverEmail,
                whatsapp: parcelData.receiverWhatsApp,
                address: parcelData.receiverAddress
            },
            
            // Package information
            package: {
                description: parcelData.packageDescription,
                weight: parseFloat(parcelData.packageWeight),
                value: parseFloat(parcelData.packageValue),
                distance: parseFloat(parcelData.estimatedDistance)
            },
            
            // Pricing
            pricing: {
                distance: parseFloat(parcelData.estimatedDistance),
                pricePerKm: BUSINESS_CONFIG.pricePerKm,
                totalAmount: calculatePrice(parseFloat(parcelData.estimatedDistance)),
                currency: BUSINESS_CONFIG.currency
            },
            
            // Status tracking
            status: PARCEL_STATUS.PENDING,
            statusHistory: [{
                status: PARCEL_STATUS.PENDING,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Parcel created, awaiting payment'
            }],
            
            // Payment information
            payment: {
                status: 'pending',
                method: 'paystack',
                reference: null
            },
            
            // Legal confirmation
            legalConfirmation: {
                confirmedNoIllegalItems: true,
                confirmedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            
            // Metadata
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            
            // Driver information (will be assigned later)
            driver: null,
            
            // Proof of delivery
            proofOfDelivery: null
        };

        // Save to Firestore first to get document ID
        const docRef = await db.collection('parcels').add(parcel);
        
        // Update with document ID
        await docRef.update({
            id: docRef.id
        });

        // Save to Google Sheets for permanent storage
        await saveToGoogleSheets(parcel, docRef.id);

        return {
            id: docRef.id,
            trackingNumber,
            totalAmount: parcel.pricing.totalAmount
        };

    } catch (error) {
        console.error('Error creating parcel:', error);
        throw error;
    }
}

// Update parcel status
async function updateParcelStatus(parcelId, newStatus, note = '', driverId = null) {
    try {
        const parcelRef = db.collection('parcels').doc(parcelId);
        const parcelDoc = await parcelRef.get();
        
        if (!parcelDoc.exists) {
            throw new Error('Parcel not found');
        }

        const parcel = parcelDoc.data();
        const updateData = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                status: newStatus,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: note,
                updatedBy: currentUser?.uid || driverId
            })
        };

        // If driver is assigned
        if (driverId) {
            updateData.driver = driverId;
        }

        await parcelRef.update(updateData);

        // Send notifications
        await sendStatusNotification(parcel, newStatus);

        return true;
    } catch (error) {
        console.error('Error updating parcel status:', error);
        throw error;
    }
}

// Get parcel by tracking number
async function getParcelByTrackingNumber(trackingNumber) {
    try {
        const snapshot = await db.collection('parcels')
            .where('trackingNumber', '==', trackingNumber.toUpperCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return {
            id: doc.id,
            ...doc.data()
        };
    } catch (error) {
        console.error('Error fetching parcel:', error);
        throw error;
    }
}

// Get user's parcels
async function getUserParcels(userId) {
    try {
        const snapshot = await db.collection('parcels')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching user parcels:', error);
        throw error;
    }
}

// Get parcels for driver
async function getDriverParcels(driverId) {
    try {
        const snapshot = await db.collection('parcels')
            .where('driver', '==', driverId)
            .where('status', 'in', [PARCEL_STATUS.PICKED_UP, PARCEL_STATUS.IN_TRANSIT])
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching driver parcels:', error);
        throw error;
    }
}

// Upload proof of delivery
async function uploadProofOfDelivery(parcelId, imageFile) {
    try {
        // Upload image to Firebase Storage
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`proof-of-delivery/${parcelId}/${Date.now()}_${imageFile.name}`);
        
        const uploadTask = await fileRef.put(imageFile);
        const downloadURL = await uploadTask.ref.getDownloadURL();

        // Update parcel with proof of delivery
        await db.collection('parcels').doc(parcelId).update({
            proofOfDelivery: {
                imageUrl: downloadURL,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                uploadedBy: currentUser.uid
            }
        });

        return downloadURL;
    } catch (error) {
        console.error('Error uploading proof of delivery:', error);
        throw error;
    }
}

// Send status notifications
async function sendStatusNotification(parcel, status) {
    try {
        const statusMessages = {
            [PARCEL_STATUS.PENDING]: `Your parcel ${parcel.trackingNumber} has been created and is awaiting pickup.`,
            [PARCEL_STATUS.PICKED_UP]: `Your parcel ${parcel.trackingNumber} has been picked up and is being processed.`,
            [PARCEL_STATUS.IN_TRANSIT]: `Your parcel ${parcel.trackingNumber} is on its way to the destination.`,
            [PARCEL_STATUS.DELIVERED]: `Your parcel ${parcel.trackingNumber} has been delivered successfully!`
        };

        const message = statusMessages[status];

        // Send WhatsApp notification
        if (parcel.receiver.whatsapp) {
            await sendWhatsAppMessage(parcel.receiver.whatsapp, message);
        }

        // Send SMS notification
        if (parcel.receiver.phone) {
            await sendSMS(parcel.receiver.phone, message);
        }

        // Send Email notification
        if (parcel.receiver.email) {
            await sendEmail(parcel.receiver.email, 'Parcel Status Update', message);
        }

    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

// WhatsApp integration
async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        // This is a placeholder - implement with your WhatsApp Business API
        console.log(`Sending WhatsApp to ${phoneNumber}: ${message}`);
        
        // Example implementation with WhatsApp Business API
        /*
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`
            },
            body: JSON.stringify({
                to: phoneNumber,
                message: message
            })
        });
        
        return await response.json();
        */
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
    }
}

// SMS integration
async function sendSMS(phoneNumber, message) {
    try {
        // This is a placeholder - implement with your SMS provider (e.g., Twilio, ClickSend)
        console.log(`Sending SMS to ${phoneNumber}: ${message}`);
        
        // Example implementation
        /*
        const response = await fetch('YOUR_SMS_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: phoneNumber,
                message: message
            })
        });
        
        return await response.json();
        */
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
}

// Email integration
async function sendEmail(to, subject, message) {
    try {
        // This is a placeholder - implement with your email service (e.g., SendGrid, Firebase Functions)
        console.log(`Sending email to ${to}: ${subject}`);
        
        // This should be implemented as a Firebase Cloud Function for security
        /*
        const response = await fetch('YOUR_EMAIL_CLOUD_FUNCTION_URL', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                message: message
            })
        });
        
        return await response.json();
        */
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Save to Google Sheets for permanent storage
async function saveToGoogleSheets(parcel, parcelId) {
    try {
        // This should be implemented as a Firebase Cloud Function
        // The function should append the parcel data to Google Sheets
        
        console.log('Saving to Google Sheets:', parcelId);
        
        /*
        const response = await fetch('YOUR_SHEETS_CLOUD_FUNCTION_URL', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parcelId: parcelId,
                trackingNumber: parcel.trackingNumber,
                senderName: parcel.sender.name,
                receiverName: parcel.receiver.name,
                amount: parcel.pricing.totalAmount,
                status: parcel.status,
                createdAt: new Date().toISOString()
            })
        });
        
        return await response.json();
        */
    } catch (error) {
        console.error('Error saving to Google Sheets:', error);
    }
}

// Clean up expired parcels (should be run as a scheduled Cloud Function)
async function cleanupExpiredParcels() {
    try {
        const now = new Date();
        const snapshot = await db.collection('parcels')
            .where('expiresAt', '<=', now)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Deleted ${snapshot.size} expired parcels`);
    } catch (error) {
        console.error('Error cleaning up expired parcels:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Ship Now button
    document.getElementById('shipNowBtn')?.addEventListener('click', () => {
        if (requireAuth()) {
            openModal('parcelModal');
            prefillSenderData();
        }
    });

    // Calculate price estimate on distance change
    document.getElementById('estimatedDistance')?.addEventListener('input', (e) => {
        const distance = parseFloat(e.target.value) || 0;
        const price = calculatePrice(distance);
        document.getElementById('priceEstimate').textContent = formatCurrency(price);
    });

    // Cancel parcel button
    document.getElementById('cancelParcelBtn')?.addEventListener('click', () => {
        closeModal('parcelModal');
        document.getElementById('parcelForm').reset();
    });

    // Parcel form submission
    document.getElementById('parcelForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!document.getElementById('legalConfirm').checked) {
            showAlert('You must confirm that the package contains no illegal items', 'error');
            return;
        }

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
            // Show loading
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating shipment...';

            // Create parcel
            const result = await createParcel(parcelData);

            // Close parcel modal
            closeModal('parcelModal');

            // Open payment modal
            initializePayment(result.id, result.trackingNumber, result.totalAmount);

        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Proceed to Payment';
        }
    });
});

// Prefill sender data from user profile
async function prefillSenderData() {
    try {
        const userData = await getCurrentUserData();
        if (userData) {
            document.getElementById('senderName').value = `${userData.firstName} ${userData.lastName}`;
            document.getElementById('senderPhone').value = userData.phone || '';
            document.getElementById('senderEmail').value = userData.email || '';
            document.getElementById('senderWhatsApp').value = userData.whatsapp || '';
        }
    } catch (error) {
        console.error('Error prefilling sender data:', error);
    }
}
