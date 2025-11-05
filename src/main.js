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
        
        console.log('Loading user data for:', this.currentUser.uid);

        // Load user's organizations
        const unsubscribe = FirestoreService.subscribeToOrganizations(
            this.currentUser.uid,
            (snapshot) => {
                console.log('Organizations snapshot received:', snapshot.size, 'documents');
                const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Parsed organizations:', orgs);
                
                if (orgs.length > 0) {
                    this.currentOrg = orgs[0];
                    console.log('Current org set to:', this.currentOrg);
                    this.loadProjects();
                } else {
                    console.log('No organizations found, creating default...');
                    this.createDefaultOrganization();
                }
            }
        );
        this.unsubscribers.push(unsubscribe);
    }

    async createDefaultOrganization() {
        console.log('Creating default organization for user:', this.currentUser.uid);
        
        try {
            const orgId = await FirestoreService.createOrganization(this.currentUser.uid, {
                name: `${this.currentUser.displayName}'s Workspace`,
                description: 'My personal workspace'
            });
            
            console.log('Default organization created with ID:', orgId);
            this.currentOrg = { id: orgId, name: `${this.currentUser.displayName}'s Workspace` };
            UI.showToast('Workspace created successfully!', 'success');
        } catch (error) {
            console.error('Error creating default organization:', error);
            UI.showToast('Error creating workspace: ' + error.message, 'error');
        }
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
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form')?.addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

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
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Prevent double submission
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            await AuthService.login(email, password);
            UI.showToast('Logged in successfully!', 'success');
        } catch (error) {
            UI.showError('login-error', error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Validate role selection
        if (!role) {
            UI.showError('signup-error', 'Please select your role (VIP or Staff)');
            return;
        }

        // Prevent double submission
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        try {
            await AuthService.signup(email, password, name, role);
            UI.showToast(`Account created as ${role}!`, 'success');
        } catch (error) {
            UI.showError('signup-error', error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
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
        // Check if organization is loaded before showing modal
        if (!this.currentOrg || !this.currentOrg.id) {
            UI.showToast('Please wait for workspace to load...', 'warning');
            console.error('Cannot show project modal: currentOrg is null', this.currentOrg);
            return;
        }
        UI.showModal('project-modal');
    }

    async handleCreateProject(e) {
        e.preventDefault();
        
        // Check if organization is loaded
        if (!this.currentOrg || !this.currentOrg.id) {
            UI.showToast('Please wait for workspace to load...', 'warning');
            console.error('Cannot create project: currentOrg is null or missing id', this.currentOrg);
            return;
        }
        
        const name = document.getElementById('project-name').value;
        const description = document.getElementById('project-description').value;
        const color = document.querySelector('input[name="project-color"]:checked')?.value || '#6366F1';
        const submitBtn = e.target.querySelector('button[type="submit"]');

        // Prevent double submission
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            console.log('Creating project with org:', this.currentOrg.id);
            await FirestoreService.createProject(this.currentOrg.id, this.currentUser.uid, {
                name,
                description,
                color
            });
            
            UI.hideModal('project-modal');
            e.target.reset();
            UI.showToast('Project created successfully!', 'success');
        } catch (error) {
            console.error('Project creation error:', error);
            UI.showToast('Error creating project: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Project';
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
        if (!this.currentProject) {
            UI.showToast('Please select a project first', 'warning');
            return;
        }

        const btn = document.getElementById('ai-optimize-btn');
        btn.disabled = true;
        btn.innerHTML = '<span>Optimizing...</span>';
        UI.showToast('AI optimization in progress...', 'info');
        
        try {
            // Import Firebase functions
            const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js');
            const functions = getFunctions();
            
            // Call AI optimization function
            const optimizeWorkload = httpsCallable(functions, 'optimizeStaffWorkload');
            const result = await optimizeWorkload({
                projectId: this.currentProject.id
            });

            UI.showToast('AI optimization complete!', 'success');
            console.log('AI Optimization result:', result.data);
            
            // Optionally show results in a modal
            alert(`AI Suggestions:\n${JSON.stringify(result.data, null, 2)}`);
            
        } catch (error) {
            console.error('AI optimization error:', error);
            UI.showToast('AI optimization failed: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg><span>AI Optimize</span>`;
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
