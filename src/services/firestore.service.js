// Firestore Service - Handles all database operations
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
    increment
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

class FirestoreService {
    // ===== ORGANIZATIONS =====
    async createOrganization(userId, data) {
        const orgRef = await addDoc(collection(db, 'organizations'), {
            ...data,
            ownerId: userId,
            members: [userId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Add user to organization members
        await addDoc(collection(db, 'organizationMembers'), {
            organizationId: orgRef.id,
            userId,
            role: 'owner',
            joinedAt: serverTimestamp()
        });
        
        return orgRef.id;
    }

    subscribeToOrganizations(userId, callback) {
        const q = query(
            collection(db, 'organizations'),
            where('members', 'array-contains', userId)
        );
        return onSnapshot(q, callback, (error) => {
            console.error('Error subscribing to organizations:', error);
        });
    }

    // ===== PROJECTS =====
    async createProject(orgId, userId, data) {
        const projectRef = await addDoc(collection(db, 'projects'), {
            ...data,
            organizationId: orgId,
            createdBy: userId,
            members: [userId],
            taskCounter: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Create default statuses
        const statusesData = [
            { name: 'To Do', color: '#6B7280', order: 1, type: 'TODO' },
            { name: 'In Progress', color: '#3B82F6', order: 2, type: 'DOING' },
            { name: 'Review', color: '#F59E0B', order: 3, type: 'DOING' },
            { name: 'Done', color: '#10B981', order: 4, type: 'DONE' }
        ];

        const batch = writeBatch(db);
        statusesData.forEach(status => {
            const statusRef = doc(collection(db, 'taskStatuses'));
            batch.set(statusRef, {
                ...status,
                projectId: projectRef.id,
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();

        return projectRef.id;
    }

    subscribeToProjects(orgId, callback) {
        const q = query(
            collection(db, 'projects'),
            where('organizationId', '==', orgId),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, callback);
    }

    // ===== TASK STATUSES =====
    subscribeToTaskStatuses(projectId, callback) {
        const q = query(
            collection(db, 'taskStatuses'),
            where('projectId', '==', projectId),
            orderBy('order', 'asc')
        );
        return onSnapshot(q, callback);
    }

    // ===== TASKS =====
    async createTask(projectId, userId, data) {
        // Increment project task counter
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        const taskOrder = (projectSnap.data().taskCounter || 0) + 1;

        await updateDoc(projectRef, {
            taskCounter: increment(1)
        });

        const taskRef = await addDoc(collection(db, 'tasks'), {
            ...data,
            projectId,
            order: taskOrder,
            createdBy: userId,
            assignees: data.assignees || [],
            labels: data.labels || [],
            priority: data.priority || 'MEDIUM',
            progress: 0,
            // NEW: Progress tracking fields
            progressPercent: data.progressPercent || 0,
            progressUpdatedAt: serverTimestamp(),
            progressMethod: data.progressMethod || 'Manual', // Manual, TimeTracked, Auto
            deadline: data.deadline || null,
            milestoneId: data.milestoneId || null,
            sharePolicy: data.sharePolicy || 'Full', // StatusOnly, Status+Title, Full
            calendarProjection: data.calendarProjection || 'Show', // Show, Hide
            isSubTask: false,
            parentTaskId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return taskRef.id;
    }

    async updateTask(taskId, data) {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    async updateTaskProgress(taskId, progressPercent, userId) {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            progressPercent,
            progressUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Log progress update
        await addDoc(collection(db, 'activityLog'), {
            eventType: 'task.progress.updated',
            userId,
            metadata: {
                taskId,
                progressPercent
            },
            timestamp: serverTimestamp()
        });
    }

    async deleteTask(taskId) {
        await deleteDoc(doc(db, 'tasks', taskId));
    }

    subscribeToTasks(projectId, callback) {
        const q = query(
            collection(db, 'tasks'),
            where('projectId', '==', projectId),
            where('isSubTask', '==', false),
            orderBy('order', 'asc')
        );
        return onSnapshot(q, callback);
    }

    subscribeToSubTasks(parentTaskId, callback) {
        const q = query(
            collection(db, 'tasks'),
            where('parentTaskId', '==', parentTaskId),
            orderBy('order', 'asc')
        );
        return onSnapshot(q, callback);
    }

    // ===== TEAM MEMBERS =====
    subscribeToProjectMembers(projectId, callback) {
        const q = query(
            collection(db, 'projectMembers'),
            where('projectId', '==', projectId)
        );
        return onSnapshot(q, callback);
    }

    async addProjectMember(projectId, userId, role = 'member') {
        await addDoc(collection(db, 'projectMembers'), {
            projectId,
            userId,
            role,
            joinedAt: serverTimestamp()
        });

        // Add to project members array
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
            members: [...(await getDoc(projectRef)).data().members, userId]
        });
    }

    // ===== BULK OPERATIONS =====
    async bulkUpdateTasks(taskIds, updateData) {
        const batch = writeBatch(db);
        taskIds.forEach(taskId => {
            const taskRef = doc(db, 'tasks', taskId);
            batch.update(taskRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    }

    async reorderTasks(tasks) {
        const batch = writeBatch(db);
        tasks.forEach(({ id, order, statusId }) => {
            const taskRef = doc(db, 'tasks', id);
            batch.update(taskRef, {
                order,
                ...(statusId && { statusId }),
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    }

    // ===== COMMENTS =====
    async addComment(taskId, userId, content) {
        await addDoc(collection(db, 'comments'), {
            taskId,
            userId,
            content,
            createdAt: serverTimestamp()
        });
    }

    subscribeToComments(taskId, callback) {
        const q = query(
            collection(db, 'comments'),
            where('taskId', '==', taskId),
            orderBy('createdAt', 'asc')
        );
        return onSnapshot(q, callback);
    }

    // ===== ACTIVITY LOG =====
    async logActivity(data) {
        await addDoc(collection(db, 'activities'), {
            ...data,
            createdAt: serverTimestamp()
        });
    }
}

export default new FirestoreService();
