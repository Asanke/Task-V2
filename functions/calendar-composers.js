/**
 * Calendar Composer Functions
 * Aggregates Tasks, Events, Deadlines, and Milestones with privacy enforcement
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Privacy enforcement helper
 * @param {object} item - Calendar item (task or event)
 * @param {string} viewerUserId - User requesting to view
 * @param {string} viewerRole - VIP or STAFF
 * @returns {object} Privacy-filtered item
 */
function applyPrivacy(item, viewerUserId, viewerRole) {
    const isOwner = item.ownerUserId === viewerUserId;
    const result = { ...item };

    // If viewer is owner, show everything
    if (isOwner) {
        result.titleRedacted = false;
        result.visibilityHint = 'Me';
        return result;
    }

    // Apply audience filter first
    const audience = item.audience || 'AssigneeOnly';
    if (audience === 'AssigneeOnly' && !isOwner) {
        return null; // Don't show at all
    }

    // Apply privacy/sharePolicy
    if (item.type === 'event') {
        switch (item.privacy) {
            case 'PrivateRedacted':
                result.title = 'Busy';
                result.titleRedacted = true;
                result.description = '';
                break;
            case 'BusyOnly':
                result.title = `Busy — ${item.category}`;
                result.titleRedacted = true;
                result.description = '';
                break;
            case 'TitleVisible':
                result.titleRedacted = false;
                break;
        }
    } else if (item.type === 'task') {
        switch (item.sharePolicy) {
            case 'StatusOnly':
                result.title = '';
                result.titleRedacted = true;
                break;
            case 'Status+Title':
                result.titleRedacted = false;
                result.description = '';
                break;
            case 'Full':
                result.titleRedacted = false;
                break;
        }
    }

    result.visibilityHint = audience === 'Business' ? 'Business' : 'Team';
    return result;
}

/**
 * Normalize item to common calendar format
 */
function normalizeItem(doc, type) {
    const data = doc.data();
    return {
        id: doc.id,
        type,
        ownerUserId: data.userId || data.createdBy,
        projectId: data.projectId || null,
        startTime: data.startTime || data.deadline || data.dueDate,
        endTime: data.endTime || null,
        title: data.title,
        status: data.status || null,
        progressPercent: data.progressPercent || 0,
        blockingPolicy: data.blockingPolicy || 'None',
        privacy: data.privacy,
        sharePolicy: data.sharePolicy,
        audience: data.audience,
        category: data.category,
        priority: data.priority
    };
}

/**
 * GET /calendar/my-feed
 * Returns user's own calendar items
 */
exports.calendarComposeMy = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const userId = context.auth.uid;
    const { start, end } = data;

    const startDate = admin.firestore.Timestamp.fromDate(new Date(start));
    const endDate = admin.firestore.Timestamp.fromDate(new Date(end));

    const items = [];

    // Get user's events
    const eventsSnapshot = await db.collection('events')
        .where('userId', '==', userId)
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

    eventsSnapshot.forEach(doc => {
        const item = normalizeItem(doc, 'event');
        if (item.calendarProjection !== 'Hide') {
            items.push(item);
        }
    });

    // Get user's tasks
    const tasksSnapshot = await db.collection('tasks')
        .where('createdBy', '==', userId)
        .where('calendarProjection', '==', 'Show')
        .get();

    tasksSnapshot.forEach(doc => {
        items.push(normalizeItem(doc, 'task'));
    });

    // Get tasks assigned to user
    const assignedSnapshot = await db.collection('tasks')
        .where('assignees', 'array-contains', userId)
        .where('calendarProjection', '==', 'Show')
        .get();

    assignedSnapshot.forEach(doc => {
        const item = normalizeItem(doc, 'task');
        if (!items.find(i => i.id === item.id)) {
            items.push(item);
        }
    });

    // Sort by startTime
    items.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
    });

    // No privacy filtering needed for own items
    items.forEach(item => {
        item.titleRedacted = false;
        item.visibilityHint = 'Me';
    });

    return { items, count: items.length };
});

/**
 * GET /calendar/team-feed
 * Returns calendar items for all team members in business
 */
exports.calendarComposeTeam = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const viewerUserId = context.auth.uid;
    const { businessId, start, end } = data;

    // Get viewer's role
    const userDoc = await db.collection('users').doc(viewerUserId).get();
    const viewerRole = userDoc.data()?.role || 'STAFF';

    const startDate = admin.firestore.Timestamp.fromDate(new Date(start));
    const endDate = admin.firestore.Timestamp.fromDate(new Date(end));

    // Get all organization members
    const orgMembers = await db.collection('organizationMembers')
        .where('organizationId', '==', businessId)
        .get();

    const memberIds = orgMembers.docs.map(doc => doc.data().userId);
    
    if (!memberIds.includes(viewerUserId)) {
        throw new functions.https.HttpsError('permission-denied', 'Not a member of this organization');
    }

    const items = [];

    // Get events from all members with Business audience
    const eventsSnapshot = await db.collection('events')
        .where('audience', 'in', ['Business', 'ProjectMembers'])
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

    eventsSnapshot.forEach(doc => {
        const item = normalizeItem(doc, 'event');
        const filtered = applyPrivacy(item, viewerUserId, viewerRole);
        if (filtered) {
            items.push(filtered);
        }
    });

    // Get tasks from team members
    for (const memberId of memberIds) {
        const tasksSnapshot = await db.collection('tasks')
            .where('createdBy', '==', memberId)
            .where('calendarProjection', '==', 'Show')
            .get();

        tasksSnapshot.forEach(doc => {
            const item = normalizeItem(doc, 'task');
            const filtered = applyPrivacy(item, viewerUserId, viewerRole);
            if (filtered) {
                items.push(filtered);
            }
        });
    }

    // Sort by startTime
    items.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
    });

    return { items, count: items.length };
});

/**
 * GET /calendar/project-feed
 * Returns calendar items for project members
 */
exports.calendarComposeProject = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const viewerUserId = context.auth.uid;
    const { projectId, start, end } = data;

    // Get project and verify membership
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    const projectData = projectDoc.data();
    if (!projectData.members.includes(viewerUserId)) {
        throw new functions.https.HttpsError('permission-denied', 'Not a project member');
    }

    const startDate = admin.firestore.Timestamp.fromDate(new Date(start));
    const endDate = admin.firestore.Timestamp.fromDate(new Date(end));

    const items = [];

    // Get project tasks
    const tasksSnapshot = await db.collection('tasks')
        .where('projectId', '==', projectId)
        .where('calendarProjection', '==', 'Show')
        .get();

    const userDoc = await db.collection('users').doc(viewerUserId).get();
    const viewerRole = userDoc.data()?.role || 'STAFF';

    tasksSnapshot.forEach(doc => {
        const item = normalizeItem(doc, 'task');
        const filtered = applyPrivacy(item, viewerUserId, viewerRole);
        if (filtered) {
            items.push(filtered);
        }
    });

    // Get project milestones
    const milestonesSnapshot = await db.collection('milestones')
        .where('projectId', '==', projectId)
        .where('dueDate', '>=', startDate)
        .where('dueDate', '<=', endDate)
        .get();

    milestonesSnapshot.forEach(doc => {
        items.push(normalizeItem(doc, 'milestone'));
    });

    // Get events with ProjectMembers audience
    const eventsSnapshot = await db.collection('events')
        .where('projectId', '==', projectId)
        .where('audience', 'in', ['ProjectMembers', 'Business'])
        .where('startTime', '>=', startDate)
        .where('startTime', '<=', endDate)
        .get();

    eventsSnapshot.forEach(doc => {
        const item = normalizeItem(doc, 'event');
        const filtered = applyPrivacy(item, viewerUserId, viewerRole);
        if (filtered) {
            items.push(filtered);
        }
    });

    // Sort by startTime
    items.sort((a, b) => {
        const aTime = a.startTime?.toDate?.() || new Date(a.startTime);
        const bTime = b.startTime?.toDate?.() || new Date(b.startTime);
        return aTime - bTime;
    });

    return { items, count: items.length };
});

/**
 * Scheduled function to recompute availability daily
 */
exports.availabilityRecomputeDaily = functions.pubsub
    .schedule('0 2 * * *') // Run at 2 AM daily
    .timeZone('UTC')
    .onRun(async (context) => {
        const today = new Date();
        const usersSnapshot = await db.collection('users').get();

        const batch = db.batch();
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const dateStr = today.toISOString().split('T')[0];

            // Compute availability (simplified version)
            const availRef = db.collection('availability').doc(`${userId}_${dateStr}`);
            batch.set(availRef, {
                userId,
                date: dateStr,
                availableHours: 8, // Default, will be computed properly
                busyHours: 0,
                ooo: false,
                computedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();
        console.log('Daily availability recomputed for all users');
        return null;
    });
