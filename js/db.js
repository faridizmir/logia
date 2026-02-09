import { db } from './auth.js';

// Profile
export async function getProfile(userId) {
    try {
        const doc = await db.collection('profiles').doc(userId).get();
        if (!doc.exists) {
            return { data: null, error: { message: 'Profile not found' } };
        }
        return { data: { id: doc.id, ...doc.data() }, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function getAllProfiles() {
    try {
        const snapshot = await db.collection('profiles').get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

// Attendance
export async function getAttendance(userId) {
    try {
        let query = db.collection('attendance');

        // Apply user filter if provided
        if (userId) {
            query = query.where('user_id', '==', userId);
        }

        // Order by check_in_time descending (latest first)
        query = query.orderBy('check_in_time', 'desc');

        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamps to ISO strings for compatibility
            check_in_time: doc.data().check_in_time?.toDate?.()?.toISOString() || doc.data().check_in_time,
            check_out_time: doc.data().check_out_time?.toDate?.()?.toISOString() || doc.data().check_out_time,
            created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
        }));
        return { data, error: null };
    } catch (error) {
        console.error('getAttendance error:', error);
        return { data: null, error };
    }
}

export async function checkIn(userId) {
    try {
        const now = new Date();
        const hours = now.getHours();
        let status = 'Present';
        if (hours >= 10) { // Late if check-in at or after 10:00 AM
            status = 'Late';
        }

        const docRef = await db.collection('attendance').add({
            user_id: userId,
            check_in_time: firebase.firestore.Timestamp.fromDate(now),
            check_out_time: null,
            status: status,
            date: now.toISOString().split('T')[0],
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        const doc = await docRef.get();
        return {
            data: {
                id: doc.id,
                ...doc.data(),
                check_in_time: doc.data().check_in_time?.toDate?.()?.toISOString()
            },
            error: null
        };
    } catch (error) {
        return { data: null, error };
    }
}

export async function checkOut(userId) {
    try {
        // Find the latest OPEN record (no check_out_time)
        const snapshot = await db.collection('attendance')
            .where('user_id', '==', userId)
            .where('check_out_time', '==', null)
            .orderBy('check_in_time', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { data: null, error: { message: 'No active check-in found to check out from.' } };
        }

        const sessionDoc = snapshot.docs[0];
        const now = new Date();

        await sessionDoc.ref.update({
            check_out_time: firebase.firestore.Timestamp.fromDate(now)
        });

        const updatedDoc = await sessionDoc.ref.get();
        return {
            data: {
                id: updatedDoc.id,
                ...updatedDoc.data(),
                check_in_time: updatedDoc.data().check_in_time?.toDate?.()?.toISOString(),
                check_out_time: updatedDoc.data().check_out_time?.toDate?.()?.toISOString()
            },
            error: null
        };
    } catch (error) {
        console.error('checkOut error:', error);
        return { data: null, error };
    }
}

export async function updateAttendance(id, updates) {
    try {
        await db.collection('attendance').doc(id).update(updates);
        const doc = await db.collection('attendance').doc(id).get();
        return { data: { id: doc.id, ...doc.data() }, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

// Absence
export async function createAbsenceRequest(userId, reason, startDate, endDate, file) {
    try {
        // Note: File upload removed - Firebase Storage not used
        // File parameter is ignored

        const docRef = await db.collection('absence_requests').add({
            user_id: userId,
            reason,
            start_date: startDate,
            end_date: endDate,
            attachment_url: null, // No file upload
            status: 'Pending',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        const doc = await docRef.get();
        return {
            data: {
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate?.()?.toISOString()
            },
            error: null
        };
    } catch (error) {
        return { data: null, error };
    }
}

export async function getAbsenceRequests(userId) {
    try {
        let query = db.collection('absence_requests');

        if (userId) {
            query = query.where('user_id', '==', userId);
        }

        query = query.orderBy('created_at', 'desc');

        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            created_at: doc.data().created_at?.toDate?.()?.toISOString() || doc.data().created_at
        }));
        return { data, error: null };
    } catch (error) {
        console.error('getAbsenceRequests error:', error);
        return { data: null, error };
    }
}

export async function updateAbsenceStatus(requestId, status) {
    try {
        await db.collection('absence_requests').doc(requestId).update({ status });
        const doc = await db.collection('absence_requests').doc(requestId).get();
        return { data: { id: doc.id, ...doc.data() }, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function deleteAbsenceRequest(requestId) {
    try {
        await db.collection('absence_requests').doc(requestId).delete();
        return { data: null, error: null };
    } catch (error) {
        return { data: null, error };
    }
}
