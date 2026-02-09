
// UI Rendering Logic

const mainContent = document.getElementById('main-content');
const userProfileHeader = document.getElementById('user-profile-header');

// --- Shared Components ---

export function renderHeader(user, profile) {
    if (!profile) return;

    userProfileHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
             <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 1.1rem;">${profile.full_name || user.email}</div>
                <div class="role-badge">${profile.role.toUpperCase()}</div>
            </div>
        </div>
        <button id="logout-btn" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.9rem;">Logout</button>
    `;
}

// --- Employee Views ---

export function renderEmployeeDashboard(uiStatus, latestRecord, customLabel) {
    let statusText = customLabel || 'Not Checked In';
    let statusColor = '#ffffff';
    let checkInDisabled = false;
    let checkOutDisabled = true;

    // State Logic
    if (uiStatus === 'checked-in') {
        // statusText set by caller (might include Late)
        statusColor = 'var(--accent-color)'; // Green
        checkInDisabled = true;
        checkOutDisabled = false;
    } else if (uiStatus === 'checked-out' || uiStatus === 'not-checked-in') {
        // Ready to check in
        statusColor = '#FFC107'; // Amber
        checkInDisabled = false;
        checkOutDisabled = true;
    } else if (uiStatus === 'absent') {
        statusColor = 'var(--secondary-color)'; // Red
        checkInDisabled = true; // Can't check in if absent? Usually yes.
        checkOutDisabled = true;
    }

    // Display times of the LATEST session
    const checkInTime = latestRecord?.check_in_time ? new Date(latestRecord.check_in_time).toLocaleTimeString() : '--:--';
    const checkOutTime = latestRecord?.check_out_time ? new Date(latestRecord.check_out_time).toLocaleTimeString() : '--:--';

    return `
        <div class="dashboard-grid">
            <!-- Status Card -->
            <div class="glass-card status-card">
                 <div id="real-time-clock" style="font-size: 3rem; font-weight: 700; text-align: center; font-family: monospace;">--:--:--</div>
                 <div id="real-time-date" style="font-size: 1rem; opacity: 0.8; margin-bottom: 1.5rem; text-align: center;">--</div>
                <h3>Current Status</h3>
                <div class="status-indicator" style="color: ${statusColor}">${statusText}</div>
                <div style="display: flex; justify-content: center; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">Latest Check In</div>
                        <div style="font-size: 1.2rem; font-weight: 600;">${checkInTime}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9rem; opacity: 0.7;">Latest Check Out</div>
                        <div style="font-size: 1.2rem; font-weight: 600;">${checkOutTime}</div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button id="btn-check-in" class="btn btn-large" ${checkInDisabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Check In</button>
                    <button id="btn-check-out" class="btn btn-large btn-danger" ${checkOutDisabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Check Out</button>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="glass-card">
                <h3>Quick Actions</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <button id="btn-request-absence" class="btn btn-secondary" style="width: 100%;">Request Absence</button>
                    <button id="btn-download-report" class="btn btn-secondary" style="width: 100%;">Download My Report</button>
                </div>
            </div>
        </div>

        <div style="margin-top: 3rem;">
            <h2>My Attendance History</h2>
            <div id="attendance-history-container">
                <!-- Kanban Board Injected Here -->
                Loading history...
            </div>
        </div>

        <div style="margin-top: 3rem;">
            <h2>My Absence Requests</h2>
            <div id="employee-absence-container">
                <!-- Absence List Injected Here -->
                Loading requests...
            </div>
        </div>
    `;
}

export function renderEmployeeAbsenceList(requests) {
    if (!requests || requests.length === 0) {
        return '<div class="glass-card" style="text-align: center; opacity: 0.7; font-style: italic;">No absence requests found.</div>';
    }

    return `
        <div class="glass-card">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; border-bottom: 1px solid var(--glass-border);">
                        <th style="padding: 10px;">Date Submitted</th>
                        <th style="padding: 10px;">Reason</th>
                        <th style="padding: 10px;">Duration</th>
                        <th style="padding: 10px;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(req => {
        let statusColor = 'rgba(255,255,255,0.2)';
        if (req.status === 'Approved') statusColor = 'var(--accent-color)';
        if (req.status === 'Rejected') statusColor = 'var(--secondary-color)';

        return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 10px;">${new Date(req.created_at).toLocaleDateString()}</td>
                                <td style="padding: 10px;">${req.reason}</td>
                                <td style="padding: 10px;">${req.start_date} to ${req.end_date}</td>
                                <td style="padding: 10px;"><span style="color: ${statusColor}; font-weight: 600;">${req.status}</span></td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

export function renderAttendanceKanban(attendanceRecords) {
    // Group records by status
    const columns = {
        'Present': [],
        'Late': []
    };

    attendanceRecords.forEach(record => {
        // Determine status if not set (simple logic)
        let status = record.status || 'Present';

        // If status isn't one of the keys, default to Present (or handle dynamically)
        if (!columns[status]) status = 'Present';

        columns[status].push(record);
    });

    let html = '<div class="kanban-board">';

    for (const [status, records] of Object.entries(columns)) {
        html += `
            <div class="kanban-column">
                <div class="kanban-header">
                    <span>${status}</span>
                    <span style="font-size: 0.9rem; opacity: 0.7;">${records.length}</span>
                </div>
                <div class="kanban-cards">
                    ${records.map(r => `
                        <div class="kanban-card">
                            <div style="font-weight: 600;">${new Date(r.date).toLocaleDateString()}</div>
                            <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 0.5rem;">
                                In: ${r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} <br>
                                Out: ${r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                        </div>
                    `).join('')}
                    ${records.length === 0 ? '<div style="font-size: 0.8rem; font-style: italic; opacity: 0.5; text-align: center;">No records</div>' : ''}
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

// --- Admin Views ---

export function renderAdminDashboard() {
    return `
        <div class="dashboard-grid" style="grid-template-columns: 1fr;"> <!-- Single col for now, can be split -->
           <div class="glass-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                        <h3>Employee Attendance Overview (Today)</h3>
                        <div id="admin-real-time-clock" style="font-size: 1rem; opacity: 0.8; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span id="admin-time" style="font-weight: 600;">--:--:--</span>
                            <span style="opacity: 0.5;">|</span>
                            <span id="admin-date">--</span>
                        </div>
                    </div>
                     <button id="btn-admin-report" class="btn btn-secondary">Download Summary Report</button>
                </div>
                <div id="admin-overview-container">
                    Loading overview...
                </div>
           </div>

           <div class="glass-card">
                <h3>Absence Requests</h3>
                <div id="admin-absence-container">
                    Loading requests...
                </div>
           </div>
        </div>
    `;
}

export function renderAdminOverviewKanban(todayRecords, allProfiles) {
    // Map of user ID to profile
    const profileMap = {};
    allProfiles.forEach(p => profileMap[p.id] = p);

    // Group by status
    const columns = {
        'Present': [],
        'Late': []
    };

    // Track who has a record
    const recordedUserIds = new Set();

    todayRecords.forEach(record => {
        recordedUserIds.add(record.user_id);
        const status = record.status || 'Present';
        if (columns[status]) {
            columns[status].push(record);
        }
    });

    // Determine who is Absent (Active employees with no record today)
    // allProfiles.forEach(p => {
    //     if (!recordedUserIds.has(p.id)) {
    //         columns['Absent'].push({ user_id: p.id, date: new Date().toISOString() });
    //     }
    // });


    let html = '<div class="kanban-board">';

    for (const [status, records] of Object.entries(columns)) {
        html += `
            <div class="kanban-column">
                <div class="kanban-header">
                    <span>${status}</span>
                    <span style="font-size: 0.9rem; opacity: 0.7;">${records.length}</span>
                </div>
                <div class="kanban-cards">
                    ${records.map(r => {
            const profile = profileMap[r.user_id] || { full_name: 'Unknown', email: 'N/A' };
            const timeInfo = r.check_in_time
                ? `${new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'No Check-in';

            return `
                        <div class="kanban-card">
                            <div style="font-weight: 600;">${profile.full_name}</div>
                            <div style="font-size: 0.8rem; opacity: 0.7;">${profile.email}</div>
                             ${status !== 'Absent' ? `<div style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--accent-color);">${timeInfo}</div>` : ''}
                        </div>
                    `}).join('')}
                    ${records.length === 0 ? '<div style="font-size: 0.8rem; font-style: italic; opacity: 0.5; text-align: center;">No employees</div>' : ''}
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

export function renderAbsenceRequestsList(requests, profiles = []) {
    if (!requests || requests.length === 0) {
        return '<p style="opacity: 0.7; font-style: italic;">No pending requests.</p>';
    }

    // Create a map for faster lookup if profiles array provided
    const profileMap = {};
    if (Array.isArray(profiles)) {
        profiles.forEach(p => profileMap[p.id] = p);
    }

    return `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr style="text-align: left; border-bottom: 1px solid var(--glass-border);">
                    <th style="padding: 10px;">Employee</th>
                    <th style="padding: 10px;">Reason</th>
                    <th style="padding: 10px;">Dates</th>

                    <th style="padding: 10px;">Status</th>
                    <th style="padding: 10px;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${requests.map(req => {
        // Try lookup by user_id
        let profileName = 'Unknown';
        if (profileMap[req.user_id]) {
            profileName = profileMap[req.user_id].full_name;
        } else if (req.profiles?.full_name) {
            profileName = req.profiles.full_name; // Fallback to joined data if available
        }

        const dates = `${req.start_date} to ${req.end_date}`;


        let statusBadge = `<span style="padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.1);">${req.status}</span>`;
        if (req.status === 'Approved') statusBadge = `<span style="padding: 4px 8px; border-radius: 4px; background: var(--accent-color);">Approved</span>`;
        if (req.status === 'Rejected') statusBadge = `<span style="padding: 4px 8px; border-radius: 4px; background: var(--secondary-color);">Rejected</span>`;

        let actions = '';
        if (req.status === 'Pending') {
            actions = `
                            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--accent-color); border-color: var(--accent-color);" onclick="app.handleAbsenceAction('${req.id}', 'Approved')">Approve</button>
                            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--secondary-color); border-color: var(--secondary-color);" onclick="app.handleAbsenceAction('${req.id}', 'Rejected')">Reject</button>
                        `;
        } else {
            actions = `
                            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; opacity: 0.7;" onclick="app.handleAbsenceAction('${req.id}', 'Pending')">Revert</button>
                             <button class="btn" style="padding: 4px 8px; font-size: 0.8rem; background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color);" onclick="app.handleDeleteAbsence('${req.id}')">Delete</button>
                        `;
        }

        return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 10px;">${profileName}</td>
                            <td style="padding: 10px;">${req.reason}</td>
                            <td style="padding: 10px;">${dates}</td>

                            <td style="padding: 10px;">${statusBadge}</td>
                            <td style="padding: 10px;">${actions}</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;
}
