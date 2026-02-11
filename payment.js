// Payment Module - Paystack Integration

let currentParcelForPayment = null;

/**
 * NEW: Triggers WhatsApp notification via Cloud Function
 */
async function sendPaymentConfirmation(parcelId, trackingNumber, amount) {
    try {
        console.log('Notifying backend of successful payment...');
        await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sendWhatsApp',
                parcelId: parcelId,
                trackingNumber: trackingNumber,
                amount: amount,
                status: 'Paid'
            })
        });
        console.log('✅ WhatsApp notification triggered');
    } catch (error) {
        console.error('❌ WhatsApp Error:', error);
    }
}

function initializePayment(parcelId, trackingNumber, amount) {
    currentParcelForPayment = { parcelId, trackingNumber, amount };
    document.getElementById('paymentAmount').textContent = formatCurrency(amount);
    openModal('paymentModal');
    setupPaystackButton(parcelId, trackingNumber, amount);
}

function setupPaystackButton(parcelId, trackingNumber, amount) {
    const container = document.getElementById('paystackButton');
    if (!container) return;

    const amountInKobo = Math.round(amount * 100);
    const payButton = document.createElement('button');
    payButton.className = 'btn btn-primary btn-large btn-block';
    payButton.textContent = `Pay ${formatCurrency(amount)} Now`;
    
    payButton.addEventListener('click', () => {
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: currentUser.email,
            amount: amountInKobo,
            currency: 'ZAR',
            ref: 'DN_' + Math.floor((Math.random() * 1000000000) + 1),
            callback: async function(response) {
                await verifyPayment(parcelId, response.reference, trackingNumber, amount);
            },
            onClose: function() {
                showAlert('Payment window closed', 'info');
            }
        });
        handler.openIframe();
    });

    container.innerHTML = '';
    container.appendChild(payButton);
}

async function verifyPayment(parcelId, reference, trackingNumber, amount) {
    try {
        // 1. Update Firestore status
        await db.collection('parcels').doc(parcelId).update({
            'payment.status': 'paid',
            'payment.reference': reference,
            'payment.paidAt': firebase.firestore.FieldValue.serverTimestamp(),
            'status': 'picked-up'
        });

        // 2. Trigger WhatsApp notification via Cloud Function
        await sendPaymentConfirmation(parcelId, trackingNumber, amount);

        // 3. UI Flow
        closeModal('paymentModal');
        openModal('successModal');
        document.getElementById('successTrackingNumber').textContent = trackingNumber;
        
        // Auto-generate labels
        if (typeof generateAndDisplayLabels === 'function') {
            await generateAndDisplayLabels(parcelId, trackingNumber);
        }

    } catch (error) {
        console.error('Verification Error:', error);
        showAlert('Payment successful, but status update failed. Please contact support.', 'error');
    }
}