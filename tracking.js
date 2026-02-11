// Tracking Module

// Track parcel by tracking number
async function trackParcel(trackingNumber) {
    try {
        const parcel = await getParcelByTrackingNumber(trackingNumber);
        
        if (!parcel) {
            showAlert('Tracking number not found. Please check and try again.', 'error');
            return null;
        }

        displayTrackingResult(parcel);
        return parcel;
    } catch (error) {
        console.error('Error tracking parcel:', error);
        showAlert('Error tracking parcel. Please try again.', 'error');
        return null;
    }
}

// Display tracking result
function displayTrackingResult(parcel) {
    const resultDiv = document.getElementById('trackingResult');
    
    if (!resultDiv) return;

    // Format dates
    const createdDate = parcel.createdAt ? formatDate(parcel.createdAt) : 'N/A';
    
    // Build status timeline
    let timelineHTML = '<div class="tracking-timeline">';
    
    const statuses = [
        {
            status: PARCEL_STATUS.PENDING,
            title: 'Order Created',
            description: 'Your parcel has been created and is awaiting pickup'
        },
        {
            status: PARCEL_STATUS.PICKED_UP,
            title: 'Picked Up',
            description: 'Your parcel has been picked up from the sender'
        },
        {
            status: PARCEL_STATUS.IN_TRANSIT,
            title: 'In Transit',
            description: 'Your parcel is on its way to the destination'
        },
        {
            status: PARCEL_STATUS.DELIVERED,
            title: 'Delivered',
            description: 'Your parcel has been successfully delivered'
        }
    ];

    statuses.forEach((statusInfo, index) => {
        const isCompleted = isStatusCompleted(parcel.status, statusInfo.status);
        const isActive = parcel.status === statusInfo.status;
        const statusClass = isCompleted ? 'completed' : (isActive ? 'active' : '');
        
        // Find timestamp for this status
        const statusHistory = parcel.statusHistory || [];
        const historyItem = statusHistory.find(h => h.status === statusInfo.status);
        const timestamp = historyItem ? formatDate(historyItem.timestamp) : '';

        timelineHTML += `
            <div class="tracking-step ${statusClass}">
                <h4>${statusInfo.title}</h4>
                <p>${statusInfo.description}</p>
                ${timestamp ? `<p class="timestamp">${timestamp}</p>` : ''}
                ${historyItem && historyItem.note ? `<p class="note">${historyItem.note}</p>` : ''}
            </div>
        `;
    });
    
    timelineHTML += '</div>';

    // Build complete result HTML
    const resultHTML = `
        <div class="tracking-header">
            <h3>Tracking: ${parcel.trackingNumber}</h3>
            <span class="status-badge ${parcel.status}">${formatStatus(parcel.status)}</span>
        </div>
        
        <div class="tracking-info">
            <div class="info-row">
                <strong>From:</strong> ${parcel.sender.name} (${parcel.sender.address})
            </div>
            <div class="info-row">
                <strong>To:</strong> ${parcel.receiver.name} (${parcel.receiver.address})
            </div>
            <div class="info-row">
                <strong>Package:</strong> ${parcel.package.description}
            </div>
            <div class="info-row">
                <strong>Created:</strong> ${createdDate}
            </div>
        </div>

        ${timelineHTML}

        ${parcel.proofOfDelivery ? `
            <div class="proof-of-delivery">
                <h4>Proof of Delivery</h4>
                <img src="${parcel.proofOfDelivery.imageUrl}" alt="Proof of Delivery" style="max-width: 100%; border-radius: 8px;">
            </div>
        ` : ''}
    `;

    resultDiv.innerHTML = resultHTML;
    resultDiv.style.display = 'block';

    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Check if status is completed
function isStatusCompleted(currentStatus, checkStatus) {
    const statusOrder = [
        PARCEL_STATUS.PENDING,
        PARCEL_STATUS.PICKED_UP,
        PARCEL_STATUS.IN_TRANSIT,
        PARCEL_STATUS.DELIVERED
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const checkIndex = statusOrder.indexOf(checkStatus);

    return checkIndex <= currentIndex;
}

// Format status for display
function formatStatus(status) {
    const statusMap = {
        [PARCEL_STATUS.PENDING]: 'Pending Pickup',
        [PARCEL_STATUS.PICKED_UP]: 'Picked Up',
        [PARCEL_STATUS.IN_TRANSIT]: 'In Transit',
        [PARCEL_STATUS.DELIVERED]: 'Delivered'
    };

    return statusMap[status] || status;
}

// Real-time tracking listener
function startRealTimeTracking(trackingNumber) {
    return db.collection('parcels')
        .where('trackingNumber', '==', trackingNumber.toUpperCase())
        .limit(1)
        .onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const parcel = {
                    id: doc.id,
                    ...doc.data()
                };
                displayTrackingResult(parcel);
            }
        }, error => {
            console.error('Error in real-time tracking:', error);
        });
}

// Stop real-time tracking
let trackingUnsubscribe = null;

function stopRealTimeTracking() {
    if (trackingUnsubscribe) {
        trackingUnsubscribe();
        trackingUnsubscribe = null;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Track button
    document.getElementById('trackBtn')?.addEventListener('click', async () => {
        const trackingInput = document.getElementById('trackingInput');
        const trackingNumber = trackingInput.value.trim().toUpperCase();

        if (!trackingNumber) {
            showAlert('Please enter a tracking number', 'error');
            return;
        }

        // Stop any existing tracking
        stopRealTimeTracking();

        // Track parcel
        const parcel = await trackParcel(trackingNumber);

        // Start real-time updates if parcel found
        if (parcel) {
            trackingUnsubscribe = startRealTimeTracking(trackingNumber);
        }
    });

    // Track on Enter key
    document.getElementById('trackingInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('trackBtn').click();
        }
    });

    // Calculate price button
    document.getElementById('calculatePriceBtn')?.addEventListener('click', () => {
        // Create a simple calculator modal
        const distance = prompt('Enter the distance in kilometers:');
        
        if (distance && !isNaN(distance)) {
            const price = calculatePrice(parseFloat(distance));
            showAlert(`Estimated price for ${distance}km: ${formatCurrency(price)}`, 'info');
        }
    });
});

// WhatsApp Bot Integration for tracking
function initWhatsAppBot() {
    // This would be implemented on your backend/server
    // The bot would listen for messages and respond with tracking info
    
    /*
    Example bot flow:
    
    User: "Track DN12345678"
    Bot: Fetches parcel info and responds with current status
    
    User: "Where is my package?"
    Bot: Asks for tracking number
    User: Provides tracking number
    Bot: Shows tracking info
    
    User: "What's the price for 10km?"
    Bot: Calculates and shows price
    
    For complex queries, bot transfers to human agent
    */
}

// Function to generate shareable tracking link
function generateTrackingLink(trackingNumber) {
    const baseURL = window.location.origin;
    return `${baseURL}?track=${trackingNumber}`;
}

// Check URL parameters for tracking number
function checkURLForTracking() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingNumber = urlParams.get('track');
    
    if (trackingNumber) {
        document.getElementById('trackingInput').value = trackingNumber;
        document.getElementById('trackBtn').click();
        
        // Scroll to tracking section
        document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', checkURLForTracking);
