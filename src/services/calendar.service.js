// Calendar & Events Service - Handles calendar events, milestones, and availability
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

class CalendarService {
    // ===== EVENTS =====
    /**
     * Create a calendar event with privacy controls
     * @param {string} userId - Event owner
     * @param {object} data - Event data
     * @returns {Promise<string>} Event ID
     */
    async createEvent(userId, data) {
        const eventRef = await addDoc(collection(db, 'events'), {
            userId,
            title: data.title,
            category: data.category || 'Work', // Private, Leisure, Work, OOO
            startTime: data.startTime,
            endTime: data.endTime,
            source: data.source || 'Manual', // Manual, Google, Microsoft
            privacy: data.privacy || 'BusyOnly', // PrivateRedacted, BusyOnly, TitleVisible
            audience: data.audience || 'AssigneeOnly', // AssigneeOnly, ProjectMembers, Business
            blockingPolicy: data.blockingPolicy || 'SoftBlock', // HardBlock, SoftBlock, None
            description: data.description || '',
            location: data.location || '',
            projectId: data.projectId || null,
            externalCalendarId: data.externalCalendarId || null,
            externalEventId: data.externalEventId || null,
            syncState: 'synced',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Log activity
        await this.logActivity('calendar.created', userId, {
            eventId: eventRef.id,
            title: data.title,
            startTime: data.startTime
        });

        return eventRef.id;
    }

    async updateEvent(eventId, data) {
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        
        await updateDoc(eventRef, {
            ...data,
            updatedAt: serverTimestamp()
        });

        await this.logActivity('calendar.updated', eventSnap.data().userId, {
            eventId,
            changes: Object.keys(data)
        });
    }

    async deleteEvent(eventId) {
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        
        await deleteDoc(eventRef);
        
        await this.logActivity('calendar.deleted', eventSnap.data().userId, {
            eventId,
            title: eventSnap.data().title
        });
    }

    subscribeToUserEvents(userId, callback) {
        const q = query(
            collection(db, 'events'),
            where('userId', '==', userId),
            orderBy('startTime', 'asc')
        );
        return onSnapshot(q, callback, (error) => {
            console.error('Error subscribing to events:', error);
        });
    }

    // ===== MILESTONES =====
    async createMilestone(projectId, data) {
        const milestoneRef = await addDoc(collection(db, 'milestones'), {
            projectId,
            title: data.title,
            dueDate: data.dueDate,
            visibility: data.visibility || 'ProjectMembers', // ProjectMembers, Business
            description: data.description || '',
            status: 'pending',
            completedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return milestoneRef.id;
    }

    async updateMilestone(milestoneId, data) {
        const milestoneRef = doc(db, 'milestones', milestoneId);
        await updateDoc(milestoneRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    subscribeToProjectMilestones(projectId, callback) {
        const q = query(
            collection(db, 'milestones'),
            where('projectId', '==', projectId),
            orderBy('dueDate', 'asc')
        );
        return onSnapshot(q, callback);
    }

    // ===== AVAILABILITY =====
    async computeAvailability(userId, date) {
        // Get events for the day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const eventsQuery = query(
            collection(db, 'events'),
            where('userId', '==', userId),
            where('startTime', '>=', Timestamp.fromDate(startOfDay)),
            where('startTime', '<=', Timestamp.fromDate(endOfDay))
        );

        const eventsSnap = await getDocs(eventsQuery);
        
        let busyHours = 0;
        let ooo = false;
        
        eventsSnap.forEach(doc => {
            const event = doc.data();
            const duration = (event.endTime.toDate() - event.startTime.toDate()) / (1000 * 60 * 60);
            
            if (event.category === 'OOO') {
                ooo = true;
            }
            
            if (event.blockingPolicy === 'HardBlock' || event.blockingPolicy === 'SoftBlock') {
                busyHours += duration;
            }
        });

        const availableHours = Math.max(0, 8 - busyHours); // Assume 8-hour workday

        // Cache availability
        const availRef = doc(db, 'availability', `${userId}_${date}`);
        await updateDoc(availRef, {
            userId,
            date,
            availableHours,
            busyHours,
            ooo,
            sourceWindow: {
                start: startOfDay,
                end: endOfDay
            },
            computedAt: serverTimestamp()
        }).catch(async () => {
            // If doesn't exist, create it
            await addDoc(collection(db, 'availability'), {
                userId,
                date,
                availableHours,
                busyHours,
                ooo,
                sourceWindow: {
                    start: startOfDay,
                    end: endOfDay
                },
                computedAt: serverTimestamp()
            });
        });

        await this.logActivity('availability.recomputed', userId, {
            date,
            availableHours,
            busyHours,
            ooo
        });

        return { availableHours, busyHours, ooo };
    }

    async getAvailability(userId, date) {
        const availRef = doc(db, 'availability', `${userId}_${date}`);
        const availSnap = await getDoc(availRef);
        
        if (availSnap.exists()) {
            return availSnap.data();
        }
        
        // Compute if not cached
        return await this.computeAvailability(userId, date);
    }

    // ===== ACTIVITY LOG =====
    async logActivity(eventType, userId, metadata) {
        await addDoc(collection(db, 'activityLog'), {
            eventType,
            userId,
            metadata,
            timestamp: serverTimestamp()
        });
    }
}

export default new CalendarService();
