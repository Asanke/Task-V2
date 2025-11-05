// UI Utility Functions
export class UI {
    static showLoading() {
        document.getElementById('loading-screen').classList.remove('hidden');
    }

    static hideLoading() {
        document.getElementById('loading-screen').classList.add('hidden');
    }

    static showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    static hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    static showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }

    static showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                ${this.getToastIcon(type)}
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    static getToastIcon(type) {
        const icons = {
            success: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--success)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>`,
            error: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--danger)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`,
            warning: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--warning)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>`,
            info: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--info)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    static updateUserProfile(user) {
        document.getElementById('user-name').textContent = user.displayName || 'User';
        document.getElementById('user-email-display').textContent = user.email;
        const initials = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
        document.getElementById('user-initials').textContent = initials;
    }

    static renderProjects(projects, onSelect) {
        const container = document.getElementById('projects-list');
        
        if (projects.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); font-size: 12px; padding: 8px;">No projects yet</p>';
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-item" data-project-id="${project.id}">
                <div class="project-color" style="background: ${project.color}"></div>
                <span>${project.name}</span>
            </div>
        `).join('');

        // Add click listeners
        container.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.project-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                onSelect(item.dataset.projectId);
            });
        });
    }

    static showProjectHeader(project) {
        const header = document.getElementById('project-header');
        header.classList.remove('hidden');
        document.getElementById('project-title').textContent = project.name;
    }

    static hideProjectHeader() {
        document.getElementById('project-header').classList.add('hidden');
    }

    static showViewTabs() {
        document.getElementById('view-tabs').classList.remove('hidden');
    }

    static hideViewTabs() {
        document.getElementById('view-tabs').classList.add('hidden');
    }

    static showTaskFilters() {
        document.getElementById('task-filters').classList.remove('hidden');
    }

    static hideTaskFilters() {
        document.getElementById('task-filters').classList.add('hidden');
    }

    static formatDate(date) {
        if (!date) return '';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    static getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
}
