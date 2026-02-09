

import { checkAuth, getCurrentUser, logout, db } from './auth.js';
import {
    getProfile, getAllProfiles,
    getAttendance, checkIn, checkOut,
    getAbsenceRequests, createAbsenceRequest, updateAbsenceStatus, deleteAbsenceRequest
} from './db.js';
import * as ui from './ui.js';
import { generatePDF } from './report.js';

// Application State
let currentUser = null;
let currentProfile = null;
let userAttendance = [];
let userAbsenceRequests = [];

// Admin State
let adminProfiles = [];
let adminAttendance = [];
let adminAbsenceRequests = [];

// Initialization
// Initialization
async function init() {
    console.log('App Initializing...');
    const loadingEl = document.querySelector('#main-content div');
    if (loadingEl) loadingEl.textContent = 'Initializing... Checking Session...';

    try {
        // Check Auth
        const user = await checkAuth();
        if (!user) {
            console.log('No session, redirecting...');
            return; // checkAuth redirects if needed
        }

        currentUser = user; // Firebase returns user directly, not session.user
        if (loadingEl) loadingEl.textContent = 'Session Found. Fetching Profile...';

        // Fetch Profile to get Role
        const { data: profile, error } = await getProfile(currentUser.uid); // Firebase uses 'uid' not 'id'

        if (error) {
            console.error('Profile fetch error:', error);
            if (loadingEl) loadingEl.innerHTML = `<div style="color: var(--secondary-color);">Error loading profile: ${error.message} <br> <button class="btn" onclick="location.reload()">Retry</button></div>`;
            return;
        }

        if (!profile) {
            console.error('Profile is null (user may not have profile document)');
            if (loadingEl) loadingEl.innerHTML = `<div style="color: var(--secondary-color);">Profile not found. Please contact admin. <br> <button class="btn" onclick="location.reload()">Retry</button></div>`;
            return;
        }

        currentProfile = profile;
        if (loadingEl) loadingEl.textContent = `Profile Loaded (${profile.role}). Rendering Dashboard...`;

        // Render Header
        ui.renderHeader(currentUser, currentProfile);

        // Bind Global Events (Logout, Modals)
        bindGlobalEvents();

        // Load Dashboard based on Role
        if (currentProfile.role === 'admin') {
            await loadAdminDashboard();
        } else {
            await loadEmployeeDashboard();
        }
    } catch (err) {
        console.error('Critical Init Error:', err);
        const loadingEl = document.querySelector('#main-content div');
        if (loadingEl) loadingEl.innerHTML = `<div style="color: var(--secondary-color);">Critical Application Error: ${err.message}</div>`;
    }
}

// Global Event Listeners
function bindGlobalEvents() {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        logout();
    });

    // Close Modals on overlay click (optional)
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// --- Utils ---
window.app.closeModal = function (modalId) {
    document.getElementById(modalId).classList.remove('active');
};

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

// --- Employee Logic ---

async function loadEmployeeDashboard() {
    const mainContent = document.getElementById('main-content');

    // Fetch Data
    const { data: attendance } = await getAttendance(currentUser.uid);
    userAttendance = attendance || []; // Sorted by Date Descending from DB

    // Fetch Reports/Absences for status
    const { data: absences } = await getAbsenceRequests(currentUser.uid);
    userAbsenceRequests = absences || [];

    // Calculate Status
    // 1. Check if there is an approved absence for TODAY
    const todayDate = new Date().toISOString().split('T')[0];
    const activeAbsence = userAbsenceRequests.find(req =>
        req.status === 'Approved' &&
        req.start_date <= todayDate &&
        req.end_date >= todayDate
    );

    // 2. Determine Check-in State (looking at the LATEST record)
    const latestRecord = userAttendance.length > 0 ? userAttendance[0] : null;

    let uiStatus = 'not-checked-in';
    let statusLabel = 'Not Checked In';

    if (activeAbsence) {
        uiStatus = 'absent';
        statusLabel = `Absent (Reason: ${activeAbsence.reason})`;
    } else {
        // If no absence, check attendance state
        if (latestRecord) {
            console.log('Latest Record:', latestRecord); // DEBUG: Inspection

            if (!latestRecord.check_out_time) {
                uiStatus = 'checked-in';
                statusLabel = latestRecord.status === 'Late' ? 'Checked In (Late)' : 'Checked In';
            } else {
                // It's closed. So we are currently "Checked Out" (ready to check in again)
                uiStatus = 'checked-out';
                statusLabel = 'Checked Out';
            }
        }
    }

    console.log('Calculated UI Status:', uiStatus); // DEBUG: Inspection

    // Render Dashboard
    mainContent.innerHTML = ui.renderEmployeeDashboard(uiStatus, latestRecord, statusLabel);

    // Render History (Kanban)
    const historyContainer = document.getElementById('attendance-history-container');
    historyContainer.innerHTML = ui.renderAttendanceKanban(userAttendance);

    // Render Absence List
    const absenceContainer = document.getElementById('employee-absence-container');
    if (absenceContainer) {
        absenceContainer.innerHTML = ui.renderEmployeeAbsenceList(userAbsenceRequests);
    }

    // Bind Employee Events
    bindEmployeeEvents(uiStatus);

    // Start Clock
    startRealTimeClock();
}

function startRealTimeClock() {
    const clockEl = document.getElementById('real-time-clock');
    const dateEl = document.getElementById('real-time-date');
    const headerClockEl = document.getElementById('header-real-time-clock');

    const updateClock = () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour12: false });
        const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (clockEl) clockEl.textContent = timeStr;
        if (dateEl) dateEl.textContent = dateStr;

        if (headerClockEl) { // Fallback if still used elsewhere or remove if unused, but removing to be clean
            // headerClockEl.innerHTML = `${timeStr}`; 
        }

        const adminTimeEl = document.getElementById('admin-time');
        const adminDateEl = document.getElementById('admin-date');
        if (adminTimeEl) adminTimeEl.textContent = timeStr;
        if (adminDateEl) adminDateEl.textContent = dateStr;
    };
    updateClock(); // Initial call
    setInterval(updateClock, 1000);
}

function bindEmployeeEvents(uiStatus) {
    const btnCheckIn = document.getElementById('btn-check-in');
    const btnCheckOut = document.getElementById('btn-check-out');
    const btnRequestAbsence = document.getElementById('btn-request-absence');
    const btnDownloadReport = document.getElementById('btn-download-report');

    if (btnCheckIn) {
        btnCheckIn.addEventListener('click', async () => {
            console.log('Check In Clicked. Current Status:', uiStatus); // DEBUG

            // Allow check-in if we are 'not-checked-in' OR 'checked-out' (which means we are ready for a new session)
            // Block only if already 'checked-in'
            if (uiStatus === 'checked-in' || uiStatus === 'absent') return;

            btnCheckIn.disabled = true;
            btnCheckIn.textContent = 'Checking in...';

            const { error } = await checkIn(currentUser.uid);
            if (error) {
                alert(error.message || 'Check-in failed');
                btnCheckIn.disabled = false;
                btnCheckIn.textContent = 'Check In';
            } else {
                await loadEmployeeDashboard(); // Refresh
            }
        });
    }

    if (btnCheckOut) {
        btnCheckOut.addEventListener('click', async () => {
            console.log('Check Out Clicked. Current Status:', uiStatus); // DEBUG

            // Block if not checked in
            if (uiStatus !== 'checked-in') return;

            btnCheckOut.disabled = true;
            btnCheckOut.textContent = 'Checking out...';

            console.log('Calling checkOut API...'); // DEBUG
            const { error, data } = await checkOut(currentUser.uid);
            console.log('CheckOut Result:', { error, data }); // DEBUG

            if (error) {
                alert(error.message || 'Check-out failed');
                btnCheckOut.disabled = false;
                btnCheckOut.textContent = 'Check Out';
            } else {
                console.log('CheckOut Success! Reloading Dashboard...'); // DEBUG
                await loadEmployeeDashboard(); // Refresh
            }
        });
    }

    if (btnRequestAbsence) {
        btnRequestAbsence.addEventListener('click', () => {
            openModal('absence-modal');
        });
    }

    if (btnDownloadReport) {
        btnDownloadReport.addEventListener('click', () => {
            openModal('report-modal');
        });
    }

    // Modal Forms
    const absenceForm = document.getElementById('absence-form');
    // Remove old listener to prevent duplicates if re-rendered (though we re-render whole content)
    // Actually safe because we wipe HTML content.
    if (absenceForm) {
        absenceForm.onsubmit = async (e) => {
            e.preventDefault();
            const reason = document.getElementById('absence-reason').value;
            const startDate = document.getElementById('absence-start').value;
            const endDate = document.getElementById('absence-end').value;
            // File upload removed - no longer using Firebase Storage

            const submitBtn = absenceForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const { error } = await createAbsenceRequest(currentUser.uid, reason, startDate, endDate, null);

            if (error) {
                alert('Submission failed: ' + error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';
            } else {
                alert('Request submitted successfully!');

                // Reset form and button
                absenceForm.reset();
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';

                window.app.closeModal('absence-modal');

                // Refresh Dashboard to show new request in the list
                await loadEmployeeDashboard();

                // Scroll to the absence section
                const absenceSection = document.getElementById('employee-absence-container');
                if (absenceSection) {
                    absenceSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        };
    }
}

// Report Generation (Employee)
window.app.generatedReport = function (type) {
    if (type === 'raw') {
        generatePDF('raw', userAttendance, currentProfile);
    } else if (type === 'summary') {
        // Employee Summary logic (Aggregate own data)
        const summary = [{
            name: currentProfile.full_name,
            present: userAttendance.filter(r => r.status === 'Present').length,
            late: userAttendance.filter(r => r.status === 'Late').length,
            absent: userAttendance.filter(r => r.status === 'Absent').length,
            totalHours: calculateTotalWorkHours(userAttendance)
        }];
        generatePDF('summary', summary, currentProfile);
    }
    window.app.closeModal('report-modal');
}


// --- Admin Logic ---

async function loadAdminDashboard() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = ui.renderAdminDashboard();

    // Fetch Data concurrently
    const [profilesRes, attendanceRes, absencesRes] = await Promise.all([
        getAllProfiles(),
        getAttendance(null), // Fetch all (no userId)
        getAbsenceRequests(null) // Fetch all
    ]);

    adminProfiles = profilesRes.data || [];
    adminAttendance = attendanceRes.data || [];
    adminAbsenceRequests = absencesRes.data || [];

    // Filter Today's Attendance for Kanban
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = adminAttendance.filter(r => r.date === today);

    // Render Overview
    const overviewContainer = document.getElementById('admin-overview-container');
    overviewContainer.innerHTML = ui.renderAdminOverviewKanban(todayAttendance, adminProfiles);

    // Render Absence Requests
    const absenceContainer = document.getElementById('admin-absence-container');
    absenceContainer.innerHTML = ui.renderAbsenceRequestsList(adminAbsenceRequests, adminProfiles);

    // Bind Admin Events
    const btnAdminReport = document.getElementById('btn-admin-report');
    if (btnAdminReport) {
        btnAdminReport.onclick = () => {
            // Admin Summary Logic
            const summaryData = adminProfiles.map(p => {
                const pAttendance = adminAttendance.filter(r => r.user_id === p.id);
                return {
                    name: p.full_name,
                    present: pAttendance.filter(r => r.status === 'Present').length,
                    late: pAttendance.filter(r => r.status === 'Late').length,
                    absent: pAttendance.filter(r => r.status === 'Absent').length,
                    totalHours: calculateTotalWorkHours(pAttendance)
                };
            });
            generatePDF('summary', summaryData, currentProfile); // Pass Admin profile
        };
    }

    // Start Clock for Admin
    startRealTimeClock();
}

// exposed for inline onclicks in Admin UI (Approve/Reject)
window.app.handleAbsenceAction = async function (requestId, newStatus) {
    let actionName = newStatus;
    if (newStatus === 'Pending') actionName = 'Revert';

    if (!confirm(`Are you sure you want to ${actionName} this request?`)) return;

    // If approving, we need to create attendance records for each day
    if (newStatus === 'Approved') {
        try {
            // First, get the absence request details
            const requestDoc = await db.collection('absence_requests').doc(requestId).get();
            if (!requestDoc.exists) {
                alert('Request not found');
                return;
            }

            const requestData = requestDoc.data();
            const { user_id, start_date, end_date } = requestData;

            // Generate all dates between start_date and end_date
            const dates = [];
            const currentDate = new Date(start_date);
            const endDateObj = new Date(end_date);

            while (currentDate <= endDateObj) {
                dates.push(currentDate.toISOString().split('T')[0]);
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Create attendance records for each date
            const batch = db.batch();
            dates.forEach(date => {
                const attendanceRef = db.collection('attendance').doc();
                batch.set(attendanceRef, {
                    user_id: user_id,
                    date: date,
                    status: 'Absent',
                    check_in_time: null,
                    check_out_time: null,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // Update the absence request status
            const requestRef = db.collection('absence_requests').doc(requestId);
            batch.update(requestRef, { status: newStatus });

            // Commit the batch
            await batch.commit();

            alert(`Request approved! Created ${dates.length} absent attendance record(s).`);
            loadAdminDashboard();
        } catch (error) {
            console.error('Error approving absence:', error);
            alert('Action failed: ' + error.message);
        }
    } else {
        // For Reject or Revert, just update the status
        const { error } = await updateAbsenceStatus(requestId, newStatus);
        if (error) {
            alert('Action failed: ' + error.message);
        } else {
            loadAdminDashboard();
        }
    }
};

function calculateTotalWorkHours(records) {
    let totalMs = 0;
    records.forEach(r => {
        if (r.check_in_time && r.check_out_time) {
            totalMs += new Date(r.check_out_time) - new Date(r.check_in_time);
        }
    });
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} Hour ${minutes} Minutes`;
}

window.app.handleDeleteAbsence = async function (requestId) {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this request?')) return;

    // Use supabase directly or create db function. Using explicit delete here for now since db.js doesn't have it.
    // Better to add to db.js but for quick impl:
    const { error } = await deleteAbsenceRequest(requestId);

    if (error) {
        alert('Delete failed: ' + error.message);
    } else {
        loadAdminDashboard();
    }
}

// Start App
init();
