// Main Application Entry Point
import AuthService from './services/auth.service.js';
import FirestoreService from './services/firestore.service.js';
import { TaskBoard } from './components/TaskBoard.js';
import { UI } from './utils/ui.js';

class App {
    constructor() {
        this.currentUser = null;
        this.currentOrg = null;
        this.currentProject = null;
        this.unsubscribers = [];
        this.taskBoard = null;
        
        this.init();
    }

    async init() {
        // Show loading screen
        UI.showLoading();

        // Setup auth state listener
        AuthService.onAuthStateChanged((user) => {
            this.handleAuthStateChange(user);
        });

        // Setup event listeners
        this.setupEventListeners();
    }

    async handleAuthStateChange(user) {
        if (user) {
            this.currentUser = user;
            await this.loadUserData();
            this.showMainView();
        } else {
            this.currentUser = null;
            this.showAuthView();
        }
        
        UI.hideLoading();
    }

    async loadUserData() {
        // Update user profile display
        UI.updateUserProfile(this.currentUser);

        // Load user's organizations
        const unsubscribe = FirestoreService.subscribeToOrganizations(
            this.currentUser.uid,
            (snapshot) => {
                const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (orgs.length > 0) {
                    this.currentOrg = orgs[0];
                    this.loadProjects();
                } else {
                    this.createDefaultOrganization();
                }
            }
        );
        this.unsubscribers.push(unsubscribe);
    }

    async createDefaultOrganization() {
        const orgId = await FirestoreService.createOrganization(this.currentUser.uid, {
            name: `${this.currentUser.displayName}'s Workspace`,
            description: 'My personal workspace'
        });
        
        this.currentOrg = { id: orgId, name: `${this.currentUser.displayName}'s Workspace` };
        UI.showToast('Workspace created successfully!', 'success');
    }

    loadProjects() {
        const unsubscribe = FirestoreService.subscribeToProjects(
            this.currentOrg.id,
            (snapshot) => {
                const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                UI.renderProjects(projects, (projectId) => this.selectProject(projectId));
                
                // Auto-select first project if none selected
                if (!this.currentProject && projects.length > 0) {
                    this.selectProject(projects[0].id);
                }
            }
        );
        this.unsubscribers.push(unsubscribe);
    }

    async selectProject(projectId) {
        // Clean up previous project subscriptions
        if (this.taskBoard) {
            this.taskBoard.destroy();
        }

        // Get project data
        const projectDoc = await FirestoreService.db.collection('projects').doc(projectId).get();
        this.currentProject = { id: projectId, ...projectDoc.data() };

        // Update UI
        UI.showProjectHeader(this.currentProject);
        UI.showViewTabs();
        UI.showTaskFilters();

        // Initialize task board
        this.taskBoard = new TaskBoard(projectId, this.currentUser.uid);
        await this.taskBoard.init();
    }

    setupEventListeners() {
        // Auth forms
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form').addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('logout-btn').addEventListener('submit', () => this.handleLogout());

        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });

        // Project creation
        document.getElementById('create-project-btn').addEventListener('click', () => this.showProjectModal());
        document.getElementById('project-form').addEventListener('submit', (e) => this.handleCreateProject(e));
        document.getElementById('close-project-modal').addEventListener('click', () => UI.hideModal('project-modal'));
        document.getElementById('cancel-project-btn').addEventListener('click', () => UI.hideModal('project-modal'));

        // Task creation
        document.getElementById('create-task-btn').addEventListener('click', () => this.showTaskModal());
        document.getElementById('empty-state-create-btn').addEventListener('click', () => this.showTaskModal());
        document.getElementById('close-task-modal').addEventListener('click', () => UI.hideModal('task-modal'));
        document.getElementById('cancel-task-btn').addEventListener('click', () => UI.hideModal('task-modal'));
        document.getElementById('task-form').addEventListener('submit', (e) => this.handleCreateTask(e));

        // View tabs
        document.querySelectorAll('.view-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchView(tab.dataset.viewType));
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.currentProject = null;
            UI.hideProjectHeader();
            UI.hideViewTabs();
            UI.hideTaskFilters();
            if (this.taskBoard) this.taskBoard.destroy();
        });

        // Search and filters
        document.getElementById('search-tasks').addEventListener('input', (e) => {
            if (this.taskBoard) this.taskBoard.search(e.target.value);
        });

        document.getElementById('filter-status').addEventListener('change', (e) => {
            if (this.taskBoard) this.taskBoard.filterByStatus(e.target.value);
        });

        document.getElementById('filter-priority').addEventListener('change', (e) => {
            if (this.taskBoard) this.taskBoard.filterByPriority(e.target.value);
        });

        document.getElementById('filter-assignee').addEventListener('change', (e) => {
            if (this.taskBoard) this.taskBoard.filterByAssignee(e.target.value);
        });

        // AI optimization
        document.getElementById('ai-optimize-btn').addEventListener('click', () => this.optimizeWithAI());
    }

    // Auth handlers
    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await AuthService.login(email, password);
            UI.showToast('Logged in successfully!', 'success');
        } catch (error) {
            UI.showError('login-error', error.message);
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            await AuthService.signup(email, password, name);
            UI.showToast('Account created successfully!', 'success');
        } catch (error) {
            UI.showError('signup-error', error.message);
        }
    }

    async handleLogout() {
        try {
            // Clean up subscriptions
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];
            
            if (this.taskBoard) this.taskBoard.destroy();
            
            await AuthService.logout();
            UI.showToast('Logged out successfully!', 'success');
        } catch (error) {
            UI.showToast('Error logging out: ' + error.message, 'error');
        }
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
        
        document.querySelectorAll('.auth-form').forEach(form => form.classList.add('hidden'));
        document.getElementById(`${tab}-form`).classList.remove('hidden');
    }

    // Project handlers
    showProjectModal() {
        UI.showModal('project-modal');
    }

    async handleCreateProject(e) {
        e.preventDefault();
        const name = document.getElementById('project-name').value;
        const description = document.getElementById('project-description').value;
        const color = document.querySelector('input[name="project-color"]:checked').value;

        try {
            await FirestoreService.createProject(this.currentOrg.id, this.currentUser.uid, {
                name,
                description,
                color
            });
            
            UI.hideModal('project-modal');
            e.target.reset();
            UI.showToast('Project created successfully!', 'success');
        } catch (error) {
            UI.showToast('Error creating project: ' + error.message, 'error');
        }
    }

    // Task handlers
    async showTaskModal() {
        if (!this.currentProject) {
            UI.showToast('Please select a project first', 'warning');
            return;
        }

        // Load task statuses
        const statusesSnapshot = await FirestoreService.db
            .collection('taskStatuses')
            .where('projectId', '==', this.currentProject.id)
            .orderBy('order', 'asc')
            .get();

        const statuses = statusesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const statusSelect = document.getElementById('task-status');
        statusSelect.innerHTML = statuses.map(status => 
            `<option value="${status.id}">${status.name}</option>`
        ).join('');

        UI.showModal('task-modal');
    }

    async handleCreateTask(e) {
        e.preventDefault();
        
        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const statusId = document.getElementById('task-status').value;
        const priority = document.getElementById('task-priority').value;
        const dueDate = document.getElementById('task-due-date').value;

        try {
            await FirestoreService.createTask(this.currentProject.id, this.currentUser.uid, {
                title,
                description,
                statusId,
                priority,
                dueDate: dueDate ? new Date(dueDate) : null
            });
            
            UI.hideModal('task-modal');
            e.target.reset();
            UI.showToast('Task created successfully!', 'success');
        } catch (error) {
            UI.showToast('Error creating task: ' + error.message, 'error');
        }
    }

    switchView(viewType) {
        document.querySelectorAll('.view-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`.view-tab[data-view-type="${viewType}"]`).classList.add('active');
        
        if (this.taskBoard) {
            this.taskBoard.switchView(viewType);
        }
    }

    async optimizeWithAI() {
        if (!this.currentProject) return;

        UI.showToast('AI optimization in progress...', 'info');
        
        // This will integrate with your existing AI Cloud Functions
        try {
            // Call AI optimization
            const response = await fetch('YOUR_CLOUD_FUNCTION_URL', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: this.currentProject.id
                })
            });

            const result = await response.json();
            UI.showToast('Tasks optimized successfully!', 'success');
        } catch (error) {
            UI.showToast('AI optimization failed: ' + error.message, 'error');
        }
    }

    // View management
    showAuthView() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('main-view').classList.add('hidden');
    }

    showMainView() {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

export default App;
