// Sistema de Autenticação DarkFov
(function() {
    'use strict';
    
    console.log('Inicializando FovDark...');

    let currentUser = null;
    let isAuthenticated = false;
    let lastTokenCheck = 0;
    let tokenCheckInterval = 300000; // 5 minutos em vez de verificações constantes

    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM carregado');
        initializeApp();
    });

    // Adicionar tratamento global de erros para evitar unhandledrejection
    window.addEventListener('unhandledrejection', function(event) {
        console.warn('⚠️ Promise rejection não tratada capturada:', event.reason);
        event.preventDefault(); // Evitar que apareça no console como erro crítico
    });

    function initializeApp() {
        try {
            setupNavigation();
            // Verificar autenticação em todas as páginas
            checkAuthenticationState();
            setupEventListeners();
            initializePage();
            console.log('Sistema inicializado');
        } catch (error) {
            console.error('Erro na inicialização:', error);
        }
    }

    function checkAuthenticationState() {
        const token = localStorage.getItem('access_token');
        const userData = localStorage.getItem('user_data');
        
        if (token && userData) {
            try {
                currentUser = JSON.parse(userData);
                isAuthenticated = true;
                updateAuthUI(true);
                console.log('Usuário autenticado:', currentUser.email);
            } catch (e) {
                console.error('Erro ao carregar dados do usuário:', e);
                clearAuthData();
                updateAuthUI(false);
            }
        } else {
            isAuthenticated = false;
            updateAuthUI(false);
        }
    }

    async function checkAuthentication() {
        try {
            const token = localStorage.getItem('access_token');
            const userData = localStorage.getItem('user_data');

            if (!token || token === 'null' || token === 'undefined') {
                clearAuthData();
                updateNavigation(false);
                return false;
            }

            // Cache do token - só verificar no servidor se passou do intervalo
            const now = Date.now();
            if (now - lastTokenCheck < tokenCheckInterval && currentUser && isAuthenticated) {
                console.log('✅ Usando cache de autenticação');
                updateNavigation(true);
                return true;
            }

            try {
                const response = await fetch('/api/verify_token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 401) {
                    clearAuthData();
                    updateNavigation(false);
                    return false;
                }

                if (response.ok) {
                    const data = await response.json();
                    if (data.valid && data.user) {
                        localStorage.setItem('user_data', JSON.stringify(data.user));
                        currentUser = data.user;
                        isAuthenticated = true;
                        lastTokenCheck = now; // Atualizar timestamp do último check
                        updateNavigation(true);
                        return true;
                    }
                }

                clearAuthData();
                updateNavigation(false);
                return false;

            } catch (networkError) {
                console.log('⚠️ Erro de rede na verificação de token:', networkError.message);
                
                // Em caso de erro de rede, manter o usuário logado se temos dados válidos
                if (userData) {
                    try {
                        const parsedUserData = JSON.parse(userData);
                        currentUser = parsedUserData;
                        isAuthenticated = true;
                        updateNavigation(true);
                        console.log('✅ Mantendo sessão ativa offline');
                        return true;
                    } catch (parseError) {
                        console.error('Erro ao fazer parse dos dados salvos:', parseError);
                    }
                }

                // Só limpar dados se realmente for necessário
                console.log('⚠️ Não foi possível manter sessão, limpando dados');
                clearAuthData();
                updateNavigation(false);
                return false;
            }
        } catch (error) {
            console.error('Erro geral na autenticação:', error);
            
            // Tentar manter a sessão se temos dados válidos no localStorage
            if (userData) {
                try {
                    const parsedUserData = JSON.parse(userData);
                    currentUser = parsedUserData;
                    isAuthenticated = true;
                    updateNavigation(true);
                    console.log('✅ Sessão mantida após erro de autenticação');
                    return true;
                } catch (parseError) {
                    console.error('Erro ao fazer parse dos dados após erro geral:', parseError);
                }
            }
            
            clearAuthData();
            updateNavigation(false);
            return false;
        }
    }

    function updateNavigation(authenticated) {
        const loginBtn = document.querySelector('.login-btn');
        const registerBtn = document.querySelector('.register-btn');
        const navMenu = document.querySelector('.nav-menu');

        if (authenticated && currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            addAuthenticatedButtons(navMenu);
        } else {
            if (loginBtn) loginBtn.style.display = 'flex';
            if (registerBtn) registerBtn.style.display = 'flex';
            removeAuthenticatedButtons();
        }
    }

    function addAuthenticatedButtons(navMenu) {
        if (!navMenu) return;

        removeAuthenticatedButtons();

        const painelBtn = document.createElement('a');
        painelBtn.href = '/painel';
        painelBtn.className = 'nav-link painel-btn';
        painelBtn.innerHTML = '<i class="fas fa-user-circle"></i><span>Painel</span>';
        navMenu.appendChild(painelBtn);

        if (currentUser && currentUser.is_admin) {
            const adminBtn = document.createElement('a');
            adminBtn.href = '/admin';
            adminBtn.className = 'nav-link admin-btn';
            adminBtn.innerHTML = '<i class="fas fa-cog"></i><span>Admin</span>';
            navMenu.appendChild(adminBtn);
        }

        const logoutBtn = document.createElement('a');
        logoutBtn.href = '#';
        logoutBtn.className = 'nav-link logout-btn';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Logout</span>';
        logoutBtn.addEventListener('click', handleLogout);
        navMenu.appendChild(logoutBtn);
    }

    function removeAuthenticatedButtons() {
        const buttons = document.querySelectorAll('.painel-btn, .admin-btn, .logout-btn');
        buttons.forEach(btn => btn.remove());
    }

    function handleLogout(e) {
        e.preventDefault();
        clearAuthData();
        showToast('Logout realizado com sucesso!', 'success');

        const protectedPages = ['/painel', '/admin'];
        if (protectedPages.includes(window.location.pathname)) {
            window.location.href = '/';
        } else {
            checkAuthentication();
        }
    }

    function updateAuthUI(authenticated) {
        const guestButtons = document.getElementById('guestButtons');
        const userButtons = document.getElementById('userButtons');
        const userEmail = document.getElementById('userEmail');

        if (authenticated && currentUser) {
            if (guestButtons) guestButtons.style.display = 'none';
            if (userButtons) userButtons.style.display = 'block';
            if (userEmail) userEmail.textContent = currentUser.email;
        } else {
            if (guestButtons) guestButtons.style.display = 'flex';
            if (userButtons) userButtons.style.display = 'none';
        }
    }

    function clearAuthData() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('user_data');
        currentUser = null;
        isAuthenticated = false;
        updateAuthUI(false);
    }

    // Função global para logout (chamada pelo onclick no HTML)
    window.logout = function() {
        clearAuthData();
        showToast('Logout realizado com sucesso!', 'success');
        window.location.href = '/';
    }

    function setupNavigation() {
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });
        }
    }

    function setupEventListeners() {
        document.addEventListener('click', function(e) {
            const navLink = e.target.closest('.nav-link');
            const navMenu = document.querySelector('.nav-menu');
            const navToggle = document.querySelector('.nav-toggle');

            if (navLink && navMenu && navToggle) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });

        window.addEventListener('storage', function(e) {
            if (e.key === 'access_token' || e.key === 'user_data') {
                // Só verificar se estamos em páginas que não são protegidas
                const protectedPages = ['/admin', '/painel'];
                if (!protectedPages.includes(window.location.pathname)) {
                    checkAuthentication();
                }
            }
        });
    }

    function initializePage() {
        const path = window.location.pathname;

        switch(path) {
            case '/login':
                initializeLoginPage();
                break;
            case '/register':
                initializeRegisterPage();
                break;
            case '/painel':
                initializePainelPage();
                break;
            case '/admin':
                initializeAdminPage();
                break;
            case '/recover':
                initializeRecoverPage();
                break;
        }
    }

    function initializeLoginPage() {
        // Não redirecionar automaticamente na página de login
        // Deixar o usuário fazer login normalmente
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    }

    async function handleLogin(e) {
        e.preventDefault();

        const form = e.target;
        const email = form.email.value.trim();
        const password = form.password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!email || !password) {
            showToast('Preencha todos os campos', 'error');
            return;
        }

        setLoading(submitBtn, true);

        try {
            clearAuthData();

            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);

            const response = await fetch('/api/login', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = 'Erro no login';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || 'Erro no login';
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta de erro:', parseError);
                }
                showToast(errorMessage, 'error');
                return;
            }

            const data = await response.json();

            if (!data.access_token || !data.user) {
                throw new Error('Dados de login inválidos recebidos do servidor');
            }

            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_data', JSON.stringify(data.user));

            currentUser = data.user;
            isAuthenticated = true;
            updateNavigation(true);

            showToast('Login realizado com sucesso!', 'success');

            setTimeout(() => {
                if (data.user.is_admin) {
                    window.location.replace('/admin');
                } else {
                    window.location.replace('/painel');
                }
            }, 1000);

        } catch (error) {
            console.error('Erro crítico no login:', error);
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    }

    function initializeRegisterPage() {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();

        const form = e.target;
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirm_password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!email || !password || !confirmPassword) {
            showToast('Preencha todos os campos', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('As senhas não coincidem', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        setLoading(submitBtn, true);

        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('password', password);
            formData.append('confirm_password', confirmPassword);

            const response = await fetch('/api/register', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = 'Erro no registro';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || 'Erro no registro';
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta de erro:', parseError);
                }
                showToast(errorMessage, 'error');
                return;
            }

            showToast('Registro realizado com sucesso! Redirecionando...', 'success');

            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);

        } catch (error) {
            console.error('Erro no registro:', error);
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    }

    function initializeRecoverPage() {
        const recoverForm = document.getElementById('recoverForm');
        const resetForm = document.getElementById('resetForm');

        if (recoverForm) {
            recoverForm.addEventListener('submit', handlePasswordRecovery);
        }

        if (resetForm) {
            resetForm.addEventListener('submit', handlePasswordReset);
        }
    }

    async function handlePasswordRecovery(e) {
        e.preventDefault();

        const form = e.target;
        const email = form.email.value.trim();
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!email) {
            showToast('Digite seu email', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Digite um email válido', 'error');
            return;
        }

        setLoading(submitBtn, true);

        try {
            const formData = new FormData();
            formData.append('email', email);

            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = 'Erro ao enviar email de recuperação';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || 'Erro ao enviar email de recuperação';
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta de erro:', parseError);
                }
                showToast(errorMessage, 'error');
                return;
            }

            showToast('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
            form.reset();

        } catch (error) {
            console.error('Erro na recuperação:', error);
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    }

    async function handlePasswordReset(e) {
        e.preventDefault();

        const form = e.target;
        const token = form.token.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirm_password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!token || !password || !confirmPassword) {
            showToast('Preencha todos os campos', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('As senhas não coincidem', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        setLoading(submitBtn, true);

        try {
            const formData = new FormData();
            formData.append('token', token);
            formData.append('password', password);
            formData.append('confirm_password', confirmPassword);

            const response = await fetch('/api/reset-password', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorMessage = 'Erro ao redefinir senha';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || 'Erro ao redefinir senha';
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta de erro:', parseError);
                }
                showToast(errorMessage, 'error');
                return;
            }

            showToast('Senha redefinida com sucesso! Redirecionando para login...', 'success');

            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);

        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    }

    function initializePainelPage() {
        if (!isAuthenticated) {
            window.location.href = '/login';
            return;
        }

        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', handleChangePassword);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();

        const form = e.target;
        const currentPassword = form.current_password.value;
        const newPassword = form.new_password.value;
        const confirmPassword = form.confirm_password.value;
        const submitBtn = form.querySelector('button[type="submit"]');

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('Preencha todos os campos', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('As novas senhas não coincidem', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('A nova senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        setLoading(submitBtn, true);

        try {
            const token = localStorage.getItem('access_token');
            const formData = new FormData();
            formData.append('current_password', currentPassword);
            formData.append('new_password', newPassword);

            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                let errorMessage = 'Erro ao alterar senha';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || 'Erro ao alterar senha';
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta de erro:', parseError);
                }
                showToast(errorMessage, 'error');
                return;
            }

            showToast('Senha alterada com sucesso!', 'success');
            form.reset();

        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    }

    function initializeAdminPage() {
        if (!isAuthenticated || !currentUser?.is_admin) {
            window.location.href = '/';
            return;
        }
    }

    function redirectUser() {
        if (currentUser?.is_admin) {
            window.location.href = '/admin';
        } else {
            window.location.href = '/painel';
        }
    }

    function setLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Enviar';
        }
    }

    function showToast(message, type = 'info') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 4000);
    }

    function getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'times-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    window.checkAuthentication = checkAuthentication;
    window.handleLogout = handleLogout;
    window.showToast = showToast;

})();