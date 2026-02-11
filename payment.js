// Payment Module - Paystack Integration

let currentParcelForPayment = null;

// Initialize payment
function initializePayment(parcelId, trackingNumber, amount) {
    currentParcelForPayment = {
        parcelId,
        trackingNumber,
        amount
    };

    // Update payment modal
    document.getElementById('paymentAmount').textContent = formatCurrency(amount);
    
    const distance = amount / BUSINESS_CONFIG.pricePerKm;
    document.getElementById('paymentDistance').textContent = `${distance.toFixed(1)} km`;

    // Open payment modal
    openModal('paymentModal');

    // Initialize Paystack
    setupPaystackButton(parcelId, trackingNumber, amount);
}

// Setup Paystack payment button
function setupPaystackButton(parcelId, trackingNumber, amount) {
    const paystackButtonContainer = document.getElementById('paystackButton');
    
    if (!paystackButtonContainer) return;

    // Convert amount to kobo (Paystack uses kobo for ZAR)
    const amountInKobo = Math.round(amount * 100);

    // Create payment button
    const payButton = document.createElement('button');
    payButton.className = 'btn btn-primary btn-large btn-block';
    payButton.textContent = `Pay ${formatCurrency(amount)} with Paystack`;
    
    payButton.addEventListener('click', () => {
        payWithPaystack(parcelId, trackingNumber, amountInKobo, amount);
    });

    paystackButtonContainer.innerHTML = '';
    paystackButtonContainer.appendChild(payButton);
}

// Process payment with Paystack
async function payWithPaystack(parcelId, trackingNumber, amountInKobo, displayAmount) {
    try {
        if (!currentUser) {
            showAlert('You must be logged in to make payment', 'error');
            return;
        }

        const userData = await getCurrentUserData();
        
        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: currentUser.email,
            amount: amountInKobo,
            currency: 'ZAR',
            ref: generatePaymentReference(parcelId),
            
            metadata: {
                custom_fields: [
                    {
                        display_name: "Parcel ID",
                        variable_name: "parcel_id",
                        value: parcelId
                    },
                    {
                        display_name: "Tracking Number",
                        variable_name: "tracking_number",
                        value: trackingNumber
                    },
                    {
                        display_name: "Customer Name",
                        variable_name: "customer_name",
                        value: `${userData.firstName} ${userData.lastName}`
                    }
                ]
            },

            onClose: function() {
                showAlert('Payment cancelled', 'info');
            },

            callback: function(response) {
                handlePaymentSuccess(parcelId, trackingNumber, response, displayAmount);
            }
        });

        handler.openIframe();

    } catch (error) {
        console.error('Payment error:', error);
        showAlert('Error processing payment. Please try again.', 'error');
    }
}

// Generate payment reference
function generatePaymentReference(parcelId) {
    return `DN_${parcelId}_${Date.now()}`;
}

// Handle successful payment
async function handlePaymentSuccess(parcelId, trackingNumber, paystackResponse, amount) {
    try {
        // Update parcel payment status
        await db.collection('parcels').doc(parcelId).update({
            'payment.status': 'completed',
            'payment.reference': paystackResponse.reference,
            'payment.transactionId': paystackResponse.trans,
            'payment.completedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'status': PARCEL_STATUS.PENDING,
            'statusHistory': firebase.firestore.FieldValue.arrayUnion({
                status: 'payment-completed',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Payment received successfully'
            })
        });

        // Close payment modal
        closeModal('paymentModal');

        // Generate labels
        await generateAndDisplayLabels(parcelId, trackingNumber);

        // Send confirmation notifications
        await sendPaymentConfirmation(parcelId, trackingNumber, amount);

        // Show success modal
        showSuccessModal(trackingNumber);

    } catch (error) {
        console.error('Error handling payment success:', error);
        showAlert('Payment was successful but there was an error updating the system. Please contact support with your reference: ' + paystackResponse.reference, 'warning');
    }
}

// Send payment confirmation
async function sendPaymentConfirmation(parcelId, trackingNumber, amount) {
    try {
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        const parcel = parcelDoc.data();

        const message = `Payment confirmed! Your parcel ${trackingNumber} has been created. Track it at: ${generateTrackingLink(trackingNumber)}`;

        // Send to sender
        if (parcel.sender.whatsapp) {
            await sendWhatsAppMessage(parcel.sender.whatsapp, message);
        }
        if (parcel.sender.email) {
            await sendEmail(
                parcel.sender.email,
                'Payment Confirmed - Done Delivery',
                `Your payment of ${formatCurrency(amount)} has been confirmed. ${message}`
            );
        }

    } catch (error) {
        console.error('Error sending payment confirmation:', error);
    }
}

// Show success modal
function showSuccessModal(trackingNumber) {
    document.getElementById('successTrackingNumber').textContent = trackingNumber;
    openModal('successModal');
}

// Verify payment (backend verification)
async function verifyPayment(reference) {
    try {
        // This should be done on the backend for security
        // Here's a placeholder for the client-side flow
        
        /*
        const response = await fetch('YOUR_BACKEND_VERIFICATION_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reference: reference
            })
        });

        const data = await response.json();
        return data.status === 'success';
        */

        console.log('Verifying payment:', reference);
        return true;
    } catch (error) {
        console.error('Error verifying payment:', error);
        return false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Cancel payment button
    document.getElementById('cancelPaymentBtn')?.addEventListener('click', async () => {
        if (currentParcelForPayment) {
            // Mark parcel as payment cancelled
            try {
                await db.collection('parcels').doc(currentParcelForPayment.parcelId).update({
                    'payment.status': 'cancelled',
                    'payment.cancelledAt': firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating payment status:', error);
            }
        }
        
        closeModal('paymentModal');
        currentParcelForPayment = null;
    });

    // Close success modal button
    document.getElementById('closeSuccessBtn')?.addEventListener('click', () => {
        closeModal('successModal');
        
        // Reset form and redirect to home
        document.getElementById('parcelForm')?.reset();
        window.location.href = '/';
    });

    // Download labels button
    document.getElementById('downloadLabelsBtn')?.addEventListener('click', () => {
        if (currentParcelForPayment) {
            downloadLabels(currentParcelForPayment.parcelId, currentParcelForPayment.trackingNumber);
        }
    });
});

// Handle payment errors
function handlePaymentError(error) {
    console.error('Payment error:', error);
    
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.message) {
        errorMessage = error.message;
    }
    
    showAlert(errorMessage, 'error');
}

// Refund payment (admin function)
async function refundPayment(parcelId, reason) {
    try {
        // This should be implemented on the backend
        // It would call Paystack's refund API
        
        await db.collection('parcels').doc(parcelId).update({
            'payment.status': 'refunded',
            'payment.refundReason': reason,
            'payment.refundedAt': firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('Refund processed successfully', 'success');
        
    } catch (error) {
        console.error('Error processing refund:', error);
        showAlert('Error processing refund', 'error');
    }
}
