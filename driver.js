/**
 * Driver Dashboard Module - Done Delivery
 * Handles real-time parcel tracking, status updates, and driver statistics.
 */

let currentDriverId = null;
let currentStatus = 'pending';
let parcelsListener = null;

// Initialize driver dashboard on Auth State Change
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/';
        return;
    }

    currentDriverId = user.uid;

    try {
        // Verify if user has the driver role
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();

        if (!userData || userData.role !== 'driver') {
            showAlert('Access denied. Drivers only.', 'error');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        // Initialize UI with driver data
        document.getElementById('driverName').textContent = `${userData.firstName} ${userData.lastName}`;
        
        // Load initial data
        loadDriverStats();
        loadParcels(currentStatus);

    } catch (error) {
        console.error("Initialization error:", error);
        showAlert("Failed to load dashboard data.", "error");
    }
});

/**
 * Loads real-time parcel data based on status
 * @param {string} status - 'pending', 'picked-up', 'in-transit', or 'delivered'
 */
async function loadParcels(status) {
    currentStatus = status;
    const container = document.getElementById('parcelsContainer');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="loader">Loading parcels...</div>';

    // Unsubscribe from previous listener to prevent memory leaks
    if (parcelsListener) parcelsListener();

    // Set up real-time listener for parcels assigned to this driver
    parcelsListener = db.collection('parcels')
        .where('status', '==', status)
        .orderBy('updatedAt', 'desc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = `<div class="empty-state">No ${status} parcels found.</div>`;
                return;
            }

            snapshot.forEach(doc => {
                const parcel = doc.data();
                const card = createParcelCard(doc.id, parcel);
                container.appendChild(card);
            });
        }, error => {
            console.error("Snapshot error:", error);
            showAlert("Error loading live updates.", "error");
        });
}

/**
 * Generates a parcel card element for the UI
 */
function createParcelCard(id, parcel) {
    const div = document.createElement('div');
    div.className = 'parcel-card';
    
    // Determine the next logical action based on current status
    let actionBtn = '';
    if (parcel.status === PARCEL_STATUS.PENDING) {
        actionBtn = `<button onclick="updateStatus('${id}', '${PARCEL_STATUS.PICKED_UP}')" class="btn-status">Mark Picked Up</button>`;
    } else if (parcel.status === PARCEL_STATUS.PICKED_UP) {
        actionBtn = `<button onclick="updateStatus('${id}', '${PARCEL_STATUS.IN_TRANSIT}')" class="btn-status">Start Delivery</button>`;
    } else if (parcel.status === PARCEL_STATUS.IN_TRANSIT) {
        actionBtn = `<button onclick="updateStatus('${id}', '${PARCEL_STATUS.DELIVERED}')" class="btn-success">Confirm Delivery</button>`;
    }

    div.innerHTML = `
        <div class="parcel-info">
            <h4>#${parcel.trackingNumber}</h4>
            <p><strong>To:</strong> ${parcel.receiver.name}</p>
            <p><strong>Address:</strong> ${parcel.receiver.address}</p>
            <p class="parcel-meta">${parcel.package.description} (${parcel.package.weight}kg)</p>
        </div>
        <div class="parcel-actions">
            <button onclick="viewParcelDetails('${id}')" class="btn-outline">Details</button>
            ${actionBtn}
        </div>
    `;
    return div;
}

/**
 * Updates the parcel status in Firestore
 */
async function updateStatus(parcelId, newStatus) {
    try {
        await db.collection('parcels').doc(parcelId).update({
            status: newStatus,
            driverId: currentDriverId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert(`Parcel updated to ${newStatus}`, 'success');
        loadDriverStats(); // Refresh stats after update
    } catch (error) {
        showAlert("Failed to update status", "error");
    }
}

/**
 * Loads daily stats for the driver
 */
async function loadDriverStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const snapshot = await db.collection('parcels')
            .where('driverId', '==', currentDriverId)
            .where('updatedAt', '>=', today)
            .get();

        let count = { pickedUp: 0, delivered: 0 };

        snapshot.forEach(doc => {
            const status = doc.data().status;
            if (status === PARCEL_STATUS.PICKED_UP) count.pickedUp++;
            if (status === PARCEL_STATUS.DELIVERED) count.delivered++;
        });

        document.getElementById('statPickups').textContent = count.pickedUp;
        document.getElementById('statDelivered').textContent = count.delivered;
    } catch (error) {
        console.error("Stats error:", error);
    }
}

/**
 * Helper to fetch parcel by tracking number
 */
async function getParcelByTrackingNumber(trackingNumber) {
    const snapshot = await db.collection('parcels')
        .where('trackingNumber', '==', trackingNumber)
        .limit(1)
        .get();
    
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

// UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadParcels(tab.getAttribute('data-status'));
        });
    });

    // Manual Tracking Search
    document.getElementById('manualSearchBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('manualTrackingInput');
        const trackingNumber = input.value.trim();
        
        if (!trackingNumber) {
            showAlert('Enter tracking number', 'error');
            return;
        }

        const parcel = await getParcelByTrackingNumber(trackingNumber);
        if (parcel) {
            closeModal('scannerModal');
            viewParcelDetails(parcel.id);
        } else {
            showAlert('Parcel not found', 'error');
        }
    });

    // Logout logic
    document.getElementById('logoutBtnMobile')?.addEventListener('click', async () => {
        if (confirm('Logout?')) {
            await auth.signOut();
            window.location.href = '/';
        }
    });
});