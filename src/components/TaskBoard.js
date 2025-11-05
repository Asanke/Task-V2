// TaskBoard Component - Handles task display and management
import FirestoreService from '../services/firestore.service.js';
import { UI } from '../utils/ui.js';

export class TaskBoard {
    constructor(projectId, userId) {
        this.projectId = projectId;
        this.userId = userId;
        this.tasks = [];
        this.statuses = [];
        this.currentView = 'list';
        this.filters = {
            search: '',
            status: '',
            priority: '',
            assignee: ''
        };
        this.unsubscribers = [];
    }

    async init() {
        // Load task statuses
        const statusUnsubscribe = FirestoreService.subscribeToTaskStatuses(
            this.projectId,
            (snapshot) => {
                this.statuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.render();
            }
        );
        this.unsubscribers.push(statusUnsubscribe);

        // Load tasks
        const tasksUnsubscribe = FirestoreService.subscribeToTasks(
            this.projectId,
            (snapshot) => {
                this.tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.render();
            }
        );
        this.unsubscribers.push(tasksUnsubscribe);

        // Setup drag and drop
        this.setupDragAndDrop();
    }

    render() {
        const filteredTasks = this.applyFilters();
        
        if (this.currentView === 'list') {
            this.renderListView(filteredTasks);
        } else if (this.currentView === 'board') {
            this.renderBoardView(filteredTasks);
        }

        // Update filter selects
        this.updateFilterOptions();
    }

    renderListView(tasks) {
        const container = document.getElementById('task-board');
        const boardView = document.getElementById('board-view');
        const emptyState = document.getElementById('empty-state');
        
        container.classList.remove('hidden');
        boardView.classList.add('hidden');

        const columns = document.getElementById('task-columns');
        
        if (this.statuses.length === 0 || tasks.length === 0) {
            columns.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        columns.innerHTML = this.statuses.map(status => {
            const statusTasks = tasks.filter(task => task.statusId === status.id);
            
            return `
                <div class="task-column" data-status-id="${status.id}">
                    <div class="column-header">
                        <div class="column-title">
                            <div style="width: 12px; height: 12px; background: ${status.color}; border-radius: 3px;"></div>
                            <h3>${status.name}</h3>
                            <span class="task-count">${statusTasks.length}</span>
                        </div>
                        <button class="btn-icon">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="column-content" data-status-id="${status.id}">
                        ${statusTasks.map(task => this.renderTaskCard(task)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderBoardView(tasks) {
        const container = document.getElementById('task-board');
        const boardView = document.getElementById('board-view');
        const emptyState = document.getElementById('empty-state');
        
        container.classList.add('hidden');
        boardView.classList.remove('hidden');

        const board = document.getElementById('kanban-board');
        
        if (this.statuses.length === 0 || tasks.length === 0) {
            board.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        board.innerHTML = this.statuses.map(status => {
            const statusTasks = tasks.filter(task => task.statusId === status.id);
            
            return `
                <div class="kanban-column" data-status-id="${status.id}">
                    <div class="column-header">
                        <div class="column-title">
                            <div style="width: 12px; height: 12px; background: ${status.color}; border-radius: 3px;"></div>
                            <h3>${status.name}</h3>
                            <span class="task-count">${statusTasks.length}</span>
                        </div>
                    </div>
                    <div class="column-content" data-status-id="${status.id}">
                        ${statusTasks.map(task => this.renderTaskCard(task)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTaskCard(task) {
        const assignees = (task.assignees || []).slice(0, 3);
        const moreAssignees = task.assignees && task.assignees.length > 3 ? task.assignees.length - 3 : 0;

        return `
            <div class="task-card" data-task-id="${task.id}" draggable="true">
                <div class="task-card-header">
                    <h4>${task.title}</h4>
                </div>
                ${task.description ? `<p class="task-card-meta">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>` : ''}
                <div class="task-card-footer">
                    <div class="task-assignees">
                        ${assignees.map(assignee => `
                            <div class="avatar" title="${assignee.name}">
                                ${UI.getInitials(assignee.name)}
                            </div>
                        `).join('')}
                        ${moreAssignees > 0 ? `<div class="avatar">+${moreAssignees}</div>` : ''}
                    </div>
                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                </div>
                ${task.dueDate ? `<div class="task-card-meta">📅 ${UI.formatDate(task.dueDate)}</div>` : ''}
            </div>
        `;
    }

    setupDragAndDrop() {
        // This will be enhanced with SortableJS or native HTML5 drag and drop
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.dataset.taskId);
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.style.opacity = '1';
            }
        });

        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.column-content')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        document.addEventListener('drop', async (e) => {
            const columnContent = e.target.closest('.column-content');
            if (columnContent) {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/html');
                const newStatusId = columnContent.dataset.statusId;
                
                try {
                    await FirestoreService.updateTask(taskId, { statusId: newStatusId });
                    UI.showToast('Task moved successfully!', 'success');
                } catch (error) {
                    UI.showToast('Error moving task: ' + error.message, 'error');
                }
            }
        });
    }

    applyFilters() {
        return this.tasks.filter(task => {
            // Search filter
            if (this.filters.search) {
                const search = this.filters.search.toLowerCase();
                const matchesTitle = task.title.toLowerCase().includes(search);
                const matchesDesc = task.description && task.description.toLowerCase().includes(search);
                if (!matchesTitle && !matchesDesc) return false;
            }

            // Status filter
            if (this.filters.status && task.statusId !== this.filters.status) {
                return false;
            }

            // Priority filter
            if (this.filters.priority && task.priority !== this.filters.priority) {
                return false;
            }

            // Assignee filter
            if (this.filters.assignee) {
                const hasAssignee = task.assignees && task.assignees.some(a => a.id === this.filters.assignee);
                if (!hasAssignee) return false;
            }

            return true;
        });
    }

    updateFilterOptions() {
        // Update status filter
        const statusSelect = document.getElementById('filter-status');
        statusSelect.innerHTML = '<option value="">All Statuses</option>' +
            this.statuses.map(status => 
                `<option value="${status.id}">${status.name}</option>`
            ).join('');
    }

    // Public methods for filtering
    search(query) {
        this.filters.search = query;
        this.render();
    }

    filterByStatus(statusId) {
        this.filters.status = statusId;
        this.render();
    }

    filterByPriority(priority) {
        this.filters.priority = priority;
        this.render();
    }

    filterByAssignee(assigneeId) {
        this.filters.assignee = assigneeId;
        this.render();
    }

    switchView(viewType) {
        this.currentView = viewType;
        this.render();
    }

    destroy() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
    }
}
