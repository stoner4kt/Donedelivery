// Driver Dashboard Module

let currentDriverId = null;
let currentStatus = 'pending';
let parcelsListener = null;

// Initialize driver dashboard
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '/';
        return;
    }

    currentDriverId = user.uid;

    // Check if user is a driver
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'driver') {
        showAlert('Access denied. This page is for drivers only.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return;
    }

    // Initialize dashboard
    document.getElementById('driverName').textContent = `${userData.firstName} ${userData.lastName}`;
    loadDriverStats();
    loadParcels(currentStatus);
});

// Load driver statistics
async function loadDriverStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's parcels
        const snapshot = await db.collection('parcels')
            .where('driver', '==', currentDriverId)
            .where('updatedAt', '>=', today)
            .get();

        let pickups = 0;
        let inTransit = 0;
        let delivered = 0;

        snapshot.forEach(doc => {
            const parcel = doc.data();
            if (parcel.status === PARCEL_STATUS.PICKED_UP) pickups++;
            if (parcel.status === PARCEL_STATUS.IN_TRANSIT) inTransit++;
            if (parcel.status === PARCEL_STATUS.DELIVERED) delivered++;
        });

        document.getElementById('todayPickups').textContent = pickups;
        document.getElementById('inTransit').textContent = inTransit;
        document.getElementById('todayDeliveries').textContent = delivered;

    } catch (error) {
        console.error('Error loading driver stats:', error);
    }
}

// Load parcels by status
function loadParcels(status) {
    // Unsubscribe from previous listener
    if (parcelsListener) {
        parcelsListener();
    }

    currentStatus = status;

    // Build query based on status
    let query = db.collection('parcels');

    if (status === 'pending') {
        // Show unassigned parcels or assigned to this driver
        query = query.where('status', '==', PARCEL_STATUS.PENDING)
                     .where('payment.status', '==', 'completed');
    } else {
        // Show parcels assigned to this driver with specific status
        query = query.where('driver', '==', currentDriverId)
                     .where('status', '==', status);
    }

    // Listen for real-time updates
    parcelsListener = query.orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            displayParcels(snapshot.docs);
        }, error => {
            console.error('Error loading parcels:', error);
            showAlert('Error loading parcels', 'error');
        });
}

// Display parcels in the list
function displayParcels(parcelDocs) {
    const parcelList = document.getElementById('parcelList');
    const emptyState = document.getElementById('emptyState');

    if (parcelDocs.length === 0) {
        parcelList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    parcelList.style.display = 'flex';
    emptyState.style.display = 'none';

    parcelList.innerHTML = '';

    parcelDocs.forEach(doc => {
        const parcel = { id: doc.id, ...doc.data() };
        const parcelCard = createParcelCard(parcel);
        parcelList.appendChild(parcelCard);
    });
}

// Create parcel card element
function createParcelCard(parcel) {
    const card = document.createElement('div');
    card.className = 'parcel-item';

    const createdDate = parcel.createdAt ? formatDate(parcel.createdAt) : 'N/A';

    card.innerHTML = `
        <div class="parcel-header">
            <h4>${parcel.trackingNumber}</h4>
            <span class="status-badge ${parcel.status}">${formatStatus(parcel.status)}</span>
        </div>
        
        <div class="parcel-details">
            <div class="detail-row">
                <span class="detail-label">From:</span>
                <span class="detail-value">${parcel.sender.name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pickup:</span>
                <span class="detail-value">${parcel.sender.address.substring(0, 40)}...</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">To:</span>
                <span class="detail-value">${parcel.receiver.name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Delivery:</span>
                <span class="detail-value">${parcel.receiver.address.substring(0, 40)}...</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Package:</span>
                <span class="detail-value">${parcel.package.description}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Weight:</span>
                <span class="detail-value">${parcel.package.weight} kg</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Created:</span>
                <span class="detail-value">${createdDate}</span>
            </div>
        </div>

        <div class="parcel-actions" id="actions-${parcel.id}">
            ${getParcelActions(parcel)}
        </div>
    `;

    return card;
}

// Get appropriate actions based on parcel status
function getParcelActions(parcel) {
    let actions = '';

    switch (parcel.status) {
        case PARCEL_STATUS.PENDING:
            if (!parcel.driver || parcel.driver === currentDriverId) {
                actions = `
                    <button class="btn btn-primary" onclick="confirmPickup('${parcel.id}')">
                        <i class="fas fa-check"></i> Confirm Pickup
                    </button>
                    <button class="btn btn-secondary" onclick="viewParcelDetails('${parcel.id}')">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                `;
            }
            break;

        case PARCEL_STATUS.PICKED_UP:
            actions = `
                <button class="btn btn-primary" onclick="startTransit('${parcel.id}')">
                    <i class="fas fa-truck"></i> Start Transit
                </button>
                <button class="btn btn-secondary" onclick="viewParcelDetails('${parcel.id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            `;
            break;

        case PARCEL_STATUS.IN_TRANSIT:
            actions = `
                <button class="btn btn-success" onclick="showDeliveryForm('${parcel.id}')">
                    <i class="fas fa-check-circle"></i> Mark Delivered
                </button>
                <button class="btn btn-secondary" onclick="viewParcelDetails('${parcel.id}')">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            `;
            break;

        case PARCEL_STATUS.DELIVERED:
            actions = `
                <button class="btn btn-secondary" onclick="viewParcelDetails('${parcel.id}')">
                    <i class="fas fa-info-circle"></i> View Details
                </button>
                ${parcel.proofOfDelivery ? `
                    <button class="btn btn-outline" onclick="viewProof('${parcel.id}')">
                        <i class="fas fa-image"></i> View Proof
                    </button>
                ` : ''}
            `;
            break;
    }

    return actions;
}

// Confirm pickup
async function confirmPickup(parcelId) {
    try {
        const confirmed = confirm('Confirm that you have picked up this parcel?');
        if (!confirmed) return;

        await db.collection('parcels').doc(parcelId).update({
            status: PARCEL_STATUS.PICKED_UP,
            driver: currentDriverId,
            pickedUpAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                status: PARCEL_STATUS.PICKED_UP,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Parcel picked up by driver',
                updatedBy: currentDriverId
            })
        });

        // Send notification
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        await sendStatusNotification(parcelDoc.data(), PARCEL_STATUS.PICKED_UP);

        showAlert('Pickup confirmed successfully!', 'success');
        loadDriverStats();

    } catch (error) {
        console.error('Error confirming pickup:', error);
        showAlert('Error confirming pickup', 'error');
    }
}

// Start transit
async function startTransit(parcelId) {
    try {
        const confirmed = confirm('Start transit for this parcel?');
        if (!confirmed) return;

        await db.collection('parcels').doc(parcelId).update({
            status: PARCEL_STATUS.IN_TRANSIT,
            inTransitAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                status: PARCEL_STATUS.IN_TRANSIT,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Parcel in transit to destination',
                updatedBy: currentDriverId
            })
        });

        // Send notification
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        await sendStatusNotification(parcelDoc.data(), PARCEL_STATUS.IN_TRANSIT);

        showAlert('Transit started successfully!', 'success');
        loadDriverStats();

    } catch (error) {
        console.error('Error starting transit:', error);
        showAlert('Error starting transit', 'error');
    }
}

// Show delivery form
function showDeliveryForm(parcelId) {
    const modalContent = document.getElementById('actionModalContent');
    modalContent.innerHTML = `
        <p>Upload proof of delivery photo:</p>
        <div class="image-upload">
            <input type="file" id="proofImage" accept="image/*" capture="environment">
            <div id="imagePreview"></div>
        </div>
        <button class="btn btn-success btn-block" onclick="markDelivered('${parcelId}')" style="margin-top: 20px;">
            <i class="fas fa-check-circle"></i> Confirm Delivery
        </button>
    `;

    // Preview image when selected
    document.getElementById('proofImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('imagePreview').innerHTML = `
                    <img src="${e.target.result}" class="image-preview" alt="Proof of delivery">
                `;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('actionModalTitle').textContent = 'Mark as Delivered';
    openModal('actionModal');
}

// Mark as delivered
async function markDelivered(parcelId) {
    try {
        const imageInput = document.getElementById('proofImage');
        if (!imageInput.files || !imageInput.files[0]) {
            showAlert('Please upload proof of delivery photo', 'error');
            return;
        }

        const confirmed = confirm('Confirm delivery of this parcel?');
        if (!confirmed) return;

        // Show loading
        const btn = event.target;
        setLoadingState(btn, true);

        // Upload proof of delivery
        const imageUrl = await uploadProofOfDelivery(parcelId, imageInput.files[0]);

        // Update parcel status
        await db.collection('parcels').doc(parcelId).update({
            status: PARCEL_STATUS.DELIVERED,
            deliveredAt: firebase.firestore.FieldValue.serverTimestamp(),
            proofOfDelivery: {
                imageUrl: imageUrl,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                uploadedBy: currentDriverId
            },
            statusHistory: firebase.firestore.FieldValue.arrayUnion({
                status: PARCEL_STATUS.DELIVERED,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                note: 'Parcel delivered successfully',
                updatedBy: currentDriverId
            })
        });

        // Send notification
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        await sendStatusNotification(parcelDoc.data(), PARCEL_STATUS.DELIVERED);

        closeModal('actionModal');
        showAlert('Parcel marked as delivered!', 'success');
        loadDriverStats();

    } catch (error) {
        console.error('Error marking as delivered:', error);
        showAlert('Error marking as delivered', 'error');
    }
}

// View parcel details
async function viewParcelDetails(parcelId) {
    try {
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        const parcel = parcelDoc.data();

        const modalContent = document.getElementById('actionModalContent');
        modalContent.innerHTML = `
            <div class="parcel-details">
                <h4>Parcel Information</h4>
                <div class="detail-row">
                    <span class="detail-label">Tracking Number:</span>
                    <span class="detail-value">${parcel.trackingNumber}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value"><span class="status-badge ${parcel.status}">${formatStatus(parcel.status)}</span></span>
                </div>
                
                <h4 style="margin-top: 20px;">Sender</h4>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${parcel.sender.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value"><a href="tel:${parcel.sender.phone}">${parcel.sender.phone}</a></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">WhatsApp:</span>
                    <span class="detail-value"><a href="https://wa.me/${parcel.sender.whatsapp}">${parcel.sender.whatsapp}</a></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${parcel.sender.address}</span>
                </div>
                
                <h4 style="margin-top: 20px;">Receiver</h4>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${parcel.receiver.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value"><a href="tel:${parcel.receiver.phone}">${parcel.receiver.phone}</a></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">WhatsApp:</span>
                    <span class="detail-value"><a href="https://wa.me/${parcel.receiver.whatsapp}">${parcel.receiver.whatsapp}</a></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${parcel.receiver.address}</span>
                </div>
                
                <h4 style="margin-top: 20px;">Package</h4>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${parcel.package.description}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Weight:</span>
                    <span class="detail-value">${parcel.package.weight} kg</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Value:</span>
                    <span class="detail-value">${formatCurrency(parcel.package.value)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Distance:</span>
                    <span class="detail-value">${parcel.package.distance} km</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value">${formatCurrency(parcel.pricing.totalAmount)}</span>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <a href="https://wa.me/${parcel.receiver.whatsapp}?text=Hello, I'm your Done Delivery driver. I have your parcel ${parcel.trackingNumber}" 
                   class="btn btn-success btn-block" target="_blank">
                    <i class="fab fa-whatsapp"></i> Contact Receiver
                </a>
            </div>
        `;

        document.getElementById('actionModalTitle').textContent = 'Parcel Details';
        openModal('actionModal');

    } catch (error) {
        console.error('Error viewing parcel details:', error);
        showAlert('Error loading parcel details', 'error');
    }
}

// View proof of delivery
async function viewProof(parcelId) {
    try {
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        const parcel = parcelDoc.data();

        if (!parcel.proofOfDelivery) {
            showAlert('No proof of delivery available', 'info');
            return;
        }

        const modalContent = document.getElementById('actionModalContent');
        modalContent.innerHTML = `
            <img src="${parcel.proofOfDelivery.imageUrl}" class="image-preview" alt="Proof of delivery">
            <p style="text-align: center; margin-top: 15px; color: var(--text-light);">
                Uploaded: ${formatDate(parcel.proofOfDelivery.uploadedAt)}
            </p>
        `;

        document.getElementById('actionModalTitle').textContent = 'Proof of Delivery';
        openModal('actionModal');

    } catch (error) {
        console.error('Error viewing proof:', error);
        showAlert('Error loading proof of delivery', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const status = tab.getAttribute('data-status');
            loadParcels(status);
        });
    });

    // Scan button
    document.getElementById('scanButton')?.addEventListener('click', () => {
        openModal('scannerModal');
    });

    // Manual search
    document.getElementById('manualSearchBtn')?.addEventListener('click', async () => {
        const trackingNumber = document.getElementById('manualTrackingInput').value.trim();
        if (!trackingNumber) {
            showAlert('Please enter a tracking number', 'error');
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

    // Logout button
    document.getElementById('logoutBtnMobile')?.addEventListener('click', async () => {
        const confirmed = confirm('Are you sure you want to logout?');
        if (confirmed) {
            await auth.signOut();
            window.location.href = '/';
        }
    });
});
