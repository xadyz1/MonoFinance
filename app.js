// SwiftFinance - Metric Flow Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let transactions = [];
    let savingsTarget = 10000;
    let dailyExpenseLimit = 1000;
    let weeklyExpenseLimit = 7000;
    let monthlyExpenseLimit = 30000;
    let expenseLimitPeriod = 'day'; // 'day', 'week', or 'month'
    let isProgrammaticCarouselScroll = false;
    let currentFilter = 'all';
    let searchQuery = '';
    let recurringExpenses = [];
    let savingsGoals = [];

    // Selected Month State (for charts & analytics navigation)
    const now = new Date();
    let selectedYear = now.getFullYear();
    let selectedMonth = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
    let pickerYear = selectedYear;

    const UK_MONTH_NAMES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const UK_MONTH_NAMES_GENITIVE = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const UK_MONTH_SHORT = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Timezone-safe YYYY-MM-DD formatter
    const getLocalDateString = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    const receiptIconHtml = (url) => {
        if (!url) return '';
        try {
            if (!['https:', 'http:'].includes(new URL(url, window.location.origin).protocol)) return '';
        } catch { return ''; }
        return `<a href="${escapeHtml(url)}" data-receipt-preview target="_blank" rel="noopener noreferrer" class="ml-1.5 shrink-0 text-brand-accent hover:text-white transition-colors" title="Ver recibo" aria-label="Ver recibo" aria-haspopup="dialog"><span class="material-symbols-outlined text-[14px]">receipt</span></a>`;
    };

    // Auth and Sync state variables
    let isDemoMode = false;
    let isRegisterMode = false;
    let currentUser = null;

    // DOM Elements - Auth Screen
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authForm = document.getElementById('auth-form');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleModeBtn = document.getElementById('auth-toggle-mode');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const authDemoBtn = document.getElementById('auth-demo-btn');

    const userInfoSection = document.getElementById('user-info-section');
    const currentUsernameDisplay = document.getElementById('current-username-display');
    const btnLogout = document.getElementById('modal-btn-logout');
    const btnImportLocal = document.getElementById('modal-btn-import-local');

    // Welcome section
    const welcomeName = document.getElementById('welcome-name');
    const welcomeAvatar = document.getElementById('welcome-avatar');
    const dashboardAdSlot = document.getElementById('dashboard-ad-slot');
    const btnChangeAvatar = document.getElementById('btn-change-avatar');
    const avatarInput = document.getElementById('avatar-input');

    // User profile
    let currentUserName = '';
    let currentUserAvatar = '';
    let currentUserRole = '';

    function updateWelcomeSection() {
        if (welcomeName) welcomeName.textContent = currentUserName || currentUser || 'Utilizador';
        [welcomeAvatar, document.getElementById('settings-avatar-preview')].forEach(image => {
            if (!image) return;
            image.onerror = () => {
                image.onerror = null;
                image.src = 'favicon.png';
            };
            image.src = currentUserAvatar || 'favicon.png';
        });
    }

    // DOM Elements - Metrics
    const totalBalanceEl = document.getElementById('total-balance');
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpensesEl = document.getElementById('total-expenses');
    const totalSavingsEl = document.getElementById('total-savings');
    const savingsBadgePctEl = document.getElementById('savings-badge-pct');

    // DOM Elements - Savings Target (Savings Screen)
    const savingsCurrentEl = document.getElementById('savings-current');
    const savingsTargetEl = document.getElementById('savings-target');
    const goalProgressFillEl = document.getElementById('goal-progress-fill');
    const goalPercentageTextEl = document.getElementById('goal-percentage-text');

    // DOM Elements - Savings Target (Dashboard Screen)
    const dbSavingsCurrentEl = document.getElementById('db-savings-current');
    const dbSavingsTargetEl = document.getElementById('db-savings-target');
    const dbGoalProgressFillEl = document.getElementById('db-goal-progress-fill');

    // View/Screen Total values
    const tabIncomeTotalEl = document.getElementById('tab-income-total');
    const tabExpensesTotalEl = document.getElementById('tab-expenses-total');

    // Forms
    const formAddSavings = document.getElementById('form-add-savings');
    const formAddIncome = document.getElementById('form-add-income');
    const formAddExpense = document.getElementById('form-add-expense');

    // Dates
    const savingsDateInput = document.getElementById('savings-date');
    const incomeDateInput = document.getElementById('income-date');
    const expenseDateInput = document.getElementById('expense-date');

    // History & Filters
    const historyList = document.getElementById('history-list');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const currentDateEl = document.getElementById('current-date');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('dashboard-search');

    // Modal Elements
    const goalModal = document.getElementById('goal-modal');
    const editGoalBtn = document.getElementById('edit-goal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const goalForm = document.getElementById('goal-form');
    const targetAmountInput = document.getElementById('target-amount');

    // Sidebar Elements
    const sidebarNavItems = document.querySelectorAll('.nav-item');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Daily Details Modal Elements
    const dailyDetailsModal = document.getElementById('daily-details-modal');
    const closeDailyModalBtn = document.getElementById('close-daily-modal-btn');
    const dailyModalDate = document.getElementById('daily-modal-date');
    const dailyModalList = document.getElementById('daily-modal-list');
    const dailyModalTotal = document.getElementById('daily-modal-total');

    // Recurring Elements
    const formAddRecurring = document.getElementById('form-add-recurring');
    const recurringExpensesList = document.getElementById('recurring-expenses-list');

    // DOM Elements - Envelopes / Goals
    const btnCreateEnvelope = document.getElementById('btn-create-envelope');
    const envelopeModal = document.getElementById('envelope-modal');
    const closeEnvelopeModalBtn = document.getElementById('close-envelope-modal-btn');
    const cancelEnvelopeBtn = document.getElementById('cancel-envelope-btn');
    const envelopeForm = document.getElementById('envelope-form');
    const envelopeIdInput = document.getElementById('envelope-id');
    const envelopeTitleInput = document.getElementById('envelope-title');
    const envelopeTargetAmountInput = document.getElementById('envelope-target-amount');
    const envelopeCurrentAmountInput = document.getElementById('envelope-current-amount');
    const envelopeTargetDateInput = document.getElementById('envelope-target-date');
    const envelopeIconVal = document.getElementById('envelope-icon-val');
    const envelopeColorVal = document.getElementById('envelope-color-val');
    const envelopeIconPicker = document.getElementById('envelope-icon-picker');
    const envelopeColorPicker = document.getElementById('envelope-color-picker');
    const envelopeModalTitle = document.getElementById('envelope-modal-title');

    const envelopeTransferModal = document.getElementById('envelope-transfer-modal');
    const closeTransferModalBtn = document.getElementById('close-transfer-modal-btn');
    const cancelTransferBtn = document.getElementById('cancel-transfer-btn');
    const envelopeTransferForm = document.getElementById('envelope-transfer-form');
    const transferEnvelopeIdInput = document.getElementById('transfer-envelope-id');
    const transferModalTitle = document.getElementById('transfer-modal-title');
    const transferModalSubtitle = document.getElementById('transfer-modal-subtitle');
    const transferTabDeposit = document.getElementById('transfer-tab-deposit');
    const transferTabWithdraw = document.getElementById('transfer-tab-withdraw');
    const transferTypeVal = document.getElementById('transfer-type-val');
    const transferAmountInput = document.getElementById('transfer-amount');
    const transferAddTxCheckbox = document.getElementById('transfer-add-tx-checkbox');
    const submitTransferBtn = document.getElementById('submit-transfer-btn');

    const GOAL_ICONS = ['savings', 'directions_car', 'flight', 'home', 'phone_iphone', 'laptop', 'shield', 'fitness_center', 'school', 'shopping_bag', 'redeem', 'star'];
    const GOAL_COLORS = ['#20a034', '#10B981', '#3B82F6', '#20a034', '#F59E0B', '#EC4899', '#14B8A6'];

    // 1. Initialize App
    const init = async () => {
        try {
            // Initialize Theme
            initTheme();

            const today = new Date();
            if (currentDateEl) currentDateEl.textContent = formatDateToLocal(today);

            // Set default date input values to today
            const todayStr = getLocalDateString(today);
            if (savingsDateInput) savingsDateInput.value = todayStr;
            if (incomeDateInput) incomeDateInput.value = todayStr;
            if (expenseDateInput) expenseDateInput.value = todayStr;

            // Build Calendar Grid inside form
            const daysGrid = document.getElementById('recurring-days-grid');
            if (daysGrid) {
                daysGrid.innerHTML = '';
                for (let d = 1; d <= 31; d++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-7 h-7 rounded-lg text-[10px] font-semibold flex items-center justify-center border border-[#202024] hover:border-brand-purple text-brand-textSecondary transition-all';
                    btn.textContent = d;
                    btn.dataset.day = d;
                    btn.addEventListener('click', () => {
                        btn.classList.toggle('bg-brand-purple');
                        btn.classList.toggle('text-white');
                        btn.classList.toggle('border-brand-purple');
                        btn.classList.toggle('text-brand-textSecondary');

                        // Update hidden input value
                        const activeBtns = daysGrid.querySelectorAll('button.bg-brand-purple');
                        const selected = [];
                        activeBtns.forEach(b => selected.push(parseInt(b.dataset.day)));
                        selected.sort((x, y) => x - y);
                        const hiddenInput = document.getElementById('recurring-days-selected');
                        if (hiddenInput) {
                            hiddenInput.value = selected.join(',');
                        }
                    });
                    daysGrid.appendChild(btn);
                }
            }

            // Attach Event Listeners
            if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

            // Forms Submit Listeners
            if (formAddSavings) formAddSavings.addEventListener('submit', handleSavingsSubmit);
            if (formAddIncome) formAddIncome.addEventListener('submit', handleIncomeSubmit);
            if (formAddExpense) formAddExpense.addEventListener('submit', handleExpenseSubmit);
            if (formAddRecurring) formAddRecurring.addEventListener('submit', handleRecurringSubmit);

            // Live category preview & smart amount suggestion listeners
            const expenseDescInput = document.getElementById('expense-description');
            const expenseAmountInput = document.getElementById('expense-amount');
            const expenseCatSelect = document.getElementById('expense-category-select');
            if (expenseDescInput) {
                expenseDescInput.addEventListener('input', () => {
                    updateExpenseCategoryPreview();
                    updateExpenseAmountSuggestions();
                });
            }
            if (expenseAmountInput) {
                expenseAmountInput.addEventListener('input', updateExpenseAmountSuggestions);
                expenseAmountInput.addEventListener('change', updateExpenseAmountSuggestions);
            }
            if (expenseCatSelect) {
                expenseCatSelect.addEventListener('change', updateExpenseCategoryPreview);
            }
            initExpenseCategoryModal();
            updateExpenseCategoryPreview();
            updateExpenseAmountSuggestions();

            const incomeDescInput = document.getElementById('income-description');
            const incomeAmountInput = document.getElementById('income-amount');
            const incomeCatSelect = document.getElementById('income-category-select');
            if (incomeDescInput) {
                incomeDescInput.addEventListener('input', () => {
                    updateIncomeCategoryPreview();
                    updateIncomeAmountSuggestions();
                });
            }
            if (incomeAmountInput) {
                incomeAmountInput.addEventListener('input', updateIncomeAmountSuggestions);
                incomeAmountInput.addEventListener('change', updateIncomeAmountSuggestions);
            }
            if (incomeCatSelect) {
                incomeCatSelect.addEventListener('change', updateIncomeCategoryPreview);
            }
            initIncomeCategoryModal();
            updateIncomeCategoryPreview();
            updateIncomeAmountSuggestions();

            // Category Details Modal Event Listeners
            const categoryDetailsModalEl = document.getElementById('category-details-modal');
            const closeCategoryDetailsModalBtn = document.getElementById('close-category-details-modal');
            if (closeCategoryDetailsModalBtn) closeCategoryDetailsModalBtn.addEventListener('click', () => window.closeCategoryModal());
            if (categoryDetailsModalEl) {
                categoryDetailsModalEl.addEventListener('click', (e) => {
                    if (e.target === categoryDetailsModalEl) window.closeCategoryModal();
                });
            }

            if (editGoalBtn) editGoalBtn.addEventListener('click', openGoalModal);
            if (closeModalBtn) closeModalBtn.addEventListener('click', closeGoalModal);
            if (goalForm) goalForm.addEventListener('submit', handleSaveGoal);

            // Envelope Modal Event Listeners
            if (btnCreateEnvelope) btnCreateEnvelope.addEventListener('click', () => openEnvelopeModal());
            if (closeEnvelopeModalBtn) closeEnvelopeModalBtn.addEventListener('click', closeEnvelopeModal);
            if (cancelEnvelopeBtn) cancelEnvelopeBtn.addEventListener('click', closeEnvelopeModal);
            if (envelopeForm) envelopeForm.addEventListener('submit', handleSaveEnvelope);
            if (envelopeModal) {
                envelopeModal.addEventListener('click', (e) => {
                    if (e.target === envelopeModal) closeEnvelopeModal();
                });
            }

            // Envelope Transfer Modal Event Listeners
            if (closeTransferModalBtn) closeTransferModalBtn.addEventListener('click', closeTransferModal);
            if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', closeTransferModal);
            if (transferTabDeposit) transferTabDeposit.addEventListener('click', () => setTransferType('deposit'));
            if (transferTabWithdraw) transferTabWithdraw.addEventListener('click', () => setTransferType('withdraw'));
            if (envelopeTransferForm) envelopeTransferForm.addEventListener('submit', handleTransferSubmit);
            if (envelopeTransferModal) {
                envelopeTransferModal.addEventListener('click', (e) => {
                    if (e.target === envelopeTransferModal) closeTransferModal();
                });
            }

            // Daily details modal close listeners
            if (closeDailyModalBtn) {
                closeDailyModalBtn.addEventListener('click', () => {
                    if (dailyDetailsModal) dailyDetailsModal.classList.remove('active');
                });
            }
            if (dailyDetailsModal) {
                dailyDetailsModal.addEventListener('click', (e) => {
                    if (e.target === dailyDetailsModal) {
                        dailyDetailsModal.classList.remove('active');
                    }
                });
            }

            // Filter tabs listeners with smooth liquid sliding pill
            filterTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const targetBtn = e.target.closest('.filter-tab') || e.currentTarget;
                    if (!targetBtn) return;

                    const oldIdx = ['all', 'income', 'expense'].indexOf(currentFilter);
                    const newFilter = targetBtn.dataset.filter || 'all';
                    const newIdx = ['all', 'income', 'expense'].indexOf(newFilter);
                    const direction = newIdx > oldIdx ? 'left' : (newIdx < oldIdx ? 'right' : '');

                    filterTabs.forEach(t => t.classList.remove('active'));
                    targetBtn.classList.add('active');
                    currentFilter = newFilter;

                    updateFilterPillPosition(currentFilter);
                    renderHistory(direction);
                });
            });

            // Swipe control for recent transactions card categories with liquid animation
            const recentTxCard = document.getElementById('recent-transactions-card');
            if (recentTxCard) {
                let txTouchStartX = 0;
                let txTouchStartY = 0;

                recentTxCard.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 1) {
                        txTouchStartX = e.touches[0].clientX;
                        txTouchStartY = e.touches[0].clientY;
                    }
                }, { passive: true });

                recentTxCard.addEventListener('touchend', (e) => {
                    if (e.changedTouches.length === 1) {
                        const diffX = txTouchStartX - e.changedTouches[0].clientX;
                        const diffY = txTouchStartY - e.changedTouches[0].clientY;

                        // Check horizontal swipe with threshold 40px and dominant horizontal axis
                        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                            const filters = ['all', 'income', 'expense'];
                            let currentIdx = filters.indexOf(currentFilter);
                            if (currentIdx === -1) currentIdx = 0;

                            let newIdx = currentIdx;
                            let direction = '';
                            if (diffX > 0 && currentIdx < filters.length - 1) {
                                // Swipe left -> Next category
                                newIdx = currentIdx + 1;
                                direction = 'left';
                            } else if (diffX < 0 && currentIdx > 0) {
                                // Swipe right -> Previous category
                                newIdx = currentIdx - 1;
                                direction = 'right';
                            }

                            if (newIdx !== currentIdx) {
                                const targetFilter = filters[newIdx];
                                currentFilter = targetFilter;

                                // Update filter buttons UI
                                filterTabs.forEach(t => {
                                    if (t.dataset.filter === targetFilter) {
                                        t.classList.add('active');
                                    } else {
                                        t.classList.remove('active');
                                    }
                                });

                                updateFilterPillPosition(targetFilter);
                                renderHistory(direction);
                            }
                        }
                    }
                }, { passive: true });
            }

            // Keep pill indicator aligned on window resize
            window.addEventListener('resize', () => {
                updateFilterPillPosition(currentFilter);
            });

            // Search listener
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value.toLowerCase().trim();
                    renderHistory();
                });
            }

            // Sidebar Navigation (SPA View Switching)
            sidebarNavItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetView = item.dataset.view;
                    if (targetView) {
                        switchView(targetView);
                    }
                });
            });

            // Clickable dashboard cards that redirect to specific views
            document.querySelectorAll('[data-go-view]').forEach(card => {
                card.addEventListener('click', () => {
                    const targetView = card.dataset.goView;
                    if (targetView) {
                        switchView(targetView);
                    }
                });
            });

            // Close modal on overlay click
            if (goalModal) {
                goalModal.addEventListener('click', (e) => {
                    if (e.target === goalModal) {
                        closeGoalModal();
                    }
                });
            }

            // Redraw charts on window resize to ensure correct coordinate mapping
            window.addEventListener('resize', renderChart);

            // Dismiss chart popups on click outside
            const handleOutsideChartDismiss = (e) => {
                if (!e.target.closest('.chart-wrapper, svg, .chart-popup-tooltip, .chart-hit-group')) {
                    hideAllChartPopups();
                }
            };
            document.addEventListener('pointerdown', handleOutsideChartDismiss);
            document.addEventListener('click', handleOutsideChartDismiss);

            // Setup Auth Event Listeners
            if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
            if (authToggleModeBtn) authToggleModeBtn.addEventListener('click', toggleAuthMode);
            if (btnLogout) btnLogout.addEventListener('click', handleLogout);
            if (btnImportLocal) btnImportLocal.addEventListener('click', handleImportLocal);

            // Admin Panel
            const adminModal = document.getElementById('admin-modal');
            const btnAdmin = document.getElementById('btn-admin');
            const closeAdminModalBtn = document.getElementById('close-admin-modal');
            if (btnAdmin) btnAdmin.addEventListener('click', () => { if (adminModal) adminModal.classList.add('active'); loadAdminUsers(); });
            if (closeAdminModalBtn) closeAdminModalBtn.addEventListener('click', () => { if (adminModal) adminModal.classList.remove('active'); });
            if (adminModal) adminModal.addEventListener('click', e => { if (e.target === adminModal) adminModal.classList.remove('active'); });

            // Settings Modal Event Listeners
            const settingsModal = document.getElementById('settings-modal');
            const btnSettings = document.getElementById('btn-settings');
            const btnMobileSettings = document.getElementById('btn-mobile-settings');
            const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
            const settingsUsernameDisplay = document.getElementById('settings-username-display');

            const settingsNameInput = document.getElementById('settings-name');
            const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
            const settingsAvatarInput = document.getElementById('settings-avatar-input');
            const settingsChangeAvatarBtn = document.getElementById('settings-change-avatar-btn');

            const openSettingsModal = () => {
                if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = currentUser || '-';
                if (settingsNameInput) settingsNameInput.value = currentUserName || '';
                if (settingsAvatarPreview) settingsAvatarPreview.src = currentUserAvatar || 'favicon.png';
                if (settingsModal) settingsModal.classList.add('active');
            };

            const closeSettingsModal = () => {
                if (settingsModal) settingsModal.classList.remove('active');
            };

            if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
            if (btnMobileSettings) btnMobileSettings.addEventListener('click', openSettingsModal);
            if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
            if (settingsModal) {
                settingsModal.addEventListener('click', (e) => {
                    if (e.target === settingsModal) {
                        closeSettingsModal();
                    }
                });
            }

            // Export Data
            const btnExport = document.getElementById('modal-btn-export-data');
            if (btnExport) btnExport.addEventListener('click', async () => {
                try {
                    const res = await fetch(getApiUrl('api/data'), { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('Fetch failed');
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'swiftfinance_export_' + new Date().toISOString().slice(0, 10) + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Dados exportados com sucesso', 'success');
                } catch { showToast('Erro ao exportar dados', 'error'); }
            });

            // Change Password
            const btnChangePassword = document.getElementById('modal-btn-change-password');
            if (btnChangePassword) btnChangePassword.addEventListener('click', async () => {
                const oldPw = document.getElementById('settings-old-password').value;
                const newPw = document.getElementById('settings-new-password').value;
                if (!oldPw || !newPw) { showToast('Preencha ambas as passwords', 'info'); return; }
                if (newPw.length < 4) { showToast('A nova password deve ter pelo menos 4 caracteres', 'info'); return; }
                try {
                    const res = await fetch(getApiUrl('api/change-password'), {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast('Password alterada com sucesso', 'success');
                        document.getElementById('settings-old-password').value = '';
                        document.getElementById('settings-new-password').value = '';
                    } else { showToast(data.message || 'Erro ao alterar password', 'error'); }
                } catch { showToast('Erro ao ligar ao servidor', 'error'); }
            });

            // Save profile
            const btnSaveProfile = document.getElementById('modal-btn-save-profile');
            if (btnSaveProfile) btnSaveProfile.addEventListener('click', async () => {
                const name = settingsNameInput ? settingsNameInput.value.trim() : '';
                let avatar = currentUserAvatar;
                console.log('[Profile Save] Starting. name:', name, 'current avatar:', avatar);
                if (settingsAvatarInput && settingsAvatarInput.files && settingsAvatarInput.files[0]) {
                    try {
                        const fd = new FormData();
                        fd.append('file', settingsAvatarInput.files[0]);
                        console.log('[Profile Save] Uploading avatar...');
                        const res = await fetch(getApiUrl('api/upload-avatar'), { method: 'POST', credentials: 'same-origin', body: fd });
                        console.log('[Profile Save] Avatar upload response:', res.status);
                        if (res.ok) { const d = await res.json(); avatar = d.url; console.log('[Profile Save] Avatar url:', avatar); }
                        else { const err = await res.text(); console.warn('[Profile Save] Avatar upload failed:', err); showToast('Erro ao enviar foto', 'error'); return; }
                    } catch (e) { console.warn('Avatar upload failed', e); showToast('Erro ao enviar foto', 'error'); return; }
                }
                try {
                    console.log('[Profile Save] Sending profile update:', { name, avatar_url: avatar });
                    const res = await fetch(getApiUrl('api/profile'), {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                        body: JSON.stringify({ name, avatar_url: avatar })
                    });
                    const data = await res.json();
                    console.log('[Profile Save] Profile update response:', res.status, data);
                    if (res.ok) {
                        currentUserName = data.name ?? name;
                        currentUserAvatar = data.avatar_url ?? avatar;
                        if (settingsAvatarInput) settingsAvatarInput.value = '';
                        updateWelcomeSection();
                        showToast('Perfil atualizado', 'success');
                    } else { showToast(data.message || 'Erro ao atualizar perfil', 'error'); }
                } catch (e) { console.error('[Profile Save] Network error:', e); showToast('Erro ao ligar ao servidor', 'error'); }
            });

            if (settingsChangeAvatarBtn && settingsAvatarInput) {
                settingsChangeAvatarBtn.addEventListener('click', () => settingsAvatarInput.click());
                settingsAvatarInput.addEventListener('change', () => {
                    if (settingsAvatarInput.files && settingsAvatarInput.files[0]) {
                        const reader = new FileReader();
                        reader.onload = e => { if (settingsAvatarPreview) settingsAvatarPreview.src = e.target.result; };
                        reader.readAsDataURL(settingsAvatarInput.files[0]);
                    }
                });
            }

            if (btnChangeAvatar && avatarInput) {
                btnChangeAvatar.addEventListener('click', () => avatarInput.click());
                avatarInput.addEventListener('change', async () => {
                    if (!avatarInput.files || !avatarInput.files[0]) return;
                    try {
                        const fd = new FormData();
                        fd.append('file', avatarInput.files[0]);
                        const res = await fetch(getApiUrl('api/upload-avatar'), { method: 'POST', credentials: 'same-origin', body: fd });
                        if (res.ok) {
                            const d = await res.json();
                            currentUserAvatar = d.url;
                            updateWelcomeSection();
                            if (settingsAvatarPreview) settingsAvatarPreview.src = d.url;
                            showToast('Foto atualizada', 'success');
                        } else { showToast('Erro ao enviar foto', 'error'); }
                    } catch { showToast('Erro ao enviar foto', 'error'); }
                });
            }

            // Mobile Bottom Navigation Event Listeners
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetView = item.dataset.view;
                    if (targetView) {
                        switchView(targetView);
                    }
                });
            });

            // Mobile Theme Toggle Event Listener
            const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
            if (themeToggleMobileBtn) themeToggleMobileBtn.addEventListener('click', toggleTheme);

            // Initialize Swipe Navigation between screens
            initSwipeNavigation();

            // Check user session
            await checkAuth();

            // Initialize Voice Recognition for iOS PWA & Desktop
            initVoiceRecognition();
        } catch (initErr) {
            console.error('Initialization error:', initErr);
        }
    };

    const initSwipeNavigation = () => {
        const viewOrder = ['dashboard', 'income', 'expenses', 'statistics'];
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            // Ignore swipe gesture inside active modals and category rows
            if (e.target.closest('.modal-overlay.active, .modal.active, .category-row-item, #stats-category-breakdown-container')) {
                touchStartX = 0;
                touchStartY = 0;
                return;
            }
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;

            if (e.changedTouches && e.changedTouches.length > 0) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;

                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;

                // Reset touch coordinates
                touchStartX = 0;
                touchStartY = 0;

                // Threshold: 50px horizontal movement, dominant over vertical scroll
                if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                    const activeView = document.querySelector('.dashboard-view.active');
                    if (!activeView) return;

                    const currentViewId = activeView.id.replace('view-', '');
                    const currentIdx = viewOrder.indexOf(currentViewId);
                    if (currentIdx === -1) return;

                    if (deltaX < 0) {
                        // Swipe Left -> Next view (slides in from right)
                        if (currentIdx < viewOrder.length - 1) {
                            switchView(viewOrder[currentIdx + 1], 'right');
                        }
                    } else {
                        // Swipe Right -> Previous view (slides in from left)
                        if (currentIdx > 0) {
                            switchView(viewOrder[currentIdx - 1], 'left');
                        }
                    }
                }
            }
        }, { passive: true });
    };

    // Helper to build robust API URLs for relative subpath hosting
    function getApiUrl(endpoint) {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        let basePath = window.location.pathname;
        // Clean URLs at root: /app and /login should use root-level API
        if (basePath === '/app' || basePath === '/login' || basePath === '/app/' || basePath === '/login/') {
            basePath = '/';
        }
        // If pathname ends with a file (e.g. index.html), strip the filename
        else if (basePath.includes('.')) {
            basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
        }
        if (!basePath.endsWith('/')) {
            basePath += '/';
        }
        return `${basePath}${cleanEndpoint}`;
    }

    function showAppScreenSmoothly() {
        if (authContainer && !authContainer.classList.contains('hidden')) {
            authContainer.classList.add('auth-hiding');
            setTimeout(() => {
                authContainer.classList.add('hidden');
                authContainer.classList.remove('auth-hiding');
            }, 300);
        } else if (authContainer) {
            authContainer.classList.add('hidden');
        }

        if (appContainer) {
            appContainer.classList.remove('hidden');
            appContainer.classList.add('app-entering');
            setTimeout(() => {
                appContainer.classList.remove('app-entering');
            }, 450);
        }
    }

    // Check auth status
    async function checkAuth() {
        try {
            const response = await fetch(getApiUrl('api/me'), { credentials: 'same-origin' });
            if (response.ok) {
                const data = await response.json();
                currentUser = data.username;
                currentUserName = data.name || '';
                currentUserAvatar = data.avatar_url || '';
                currentUserRole = data.role || 'user';
                updateWelcomeSection();
                isDemoMode = false;

                // Smooth UI transition
                showAppScreenSmoothly();

                if (userInfoSection) userInfoSection.classList.remove('hidden');
                if (currentUsernameDisplay) currentUsernameDisplay.textContent = currentUser;
                if (btnImportLocal) btnImportLocal.classList.remove('hidden');
                if (btnLogout) {
                    btnLogout.classList.remove('hidden');
                    const textSpan = btnLogout.querySelector('span:not(.material-symbols-outlined)');
                    if (textSpan) textSpan.textContent = 'Terminar sessão';
                }
                const mobileVoiceBtn = document.getElementById('mobile-voice-btn');
                if (mobileVoiceBtn) mobileVoiceBtn.classList.remove('hidden');

                // Fetch user data from server
                await fetchUserData();

                // Show admin button if admin
                if (data.role === 'admin') {
                    const adminBtn = document.getElementById('btn-admin');
                    if (adminBtn) adminBtn.classList.remove('hidden');
                }
            } else {
                showAuthScreen();
            }
        } catch (e) {
            console.error('Auth check failed, falling back to offline check', e);
            showAuthScreen();
        }
    }

    function showAuthScreen() {
        if (authContainer) authContainer.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        if (userInfoSection) userInfoSection.classList.add('hidden');
        if (btnImportLocal) btnImportLocal.classList.add('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        const mobileVoiceBtn = document.getElementById('mobile-voice-btn');
        if (mobileVoiceBtn) mobileVoiceBtn.classList.add('hidden');
    }

    function toggleAuthMode() {
        isRegisterMode = !isRegisterMode;
        if (isRegisterMode) {
            if (authTitle) authTitle.textContent = 'Registar-se';
            if (authSubtitle) authSubtitle.textContent = 'Crie uma conta nova para sincronizar os seus dados';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Registar-se';
            if (authToggleModeBtn) authToggleModeBtn.textContent = 'Já tem conta? Entrar';
        } else {
            if (authTitle) authTitle.textContent = 'Entrar';
            if (authSubtitle) authSubtitle.textContent = 'Introduza os seus dados de acesso para abrir o painel';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Entrar';
            if (authToggleModeBtn) authToggleModeBtn.textContent = 'Não tem conta? Registar-se';
        }
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const username = authUsernameInput ? authUsernameInput.value.trim() : '';
        const password = authPasswordInput ? authPasswordInput.value : '';

        if (!username || !password) return;

        const url = isRegisterMode ? 'api/register' : 'api/login';
        try {
            const response = await fetch(getApiUrl(url), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (response.ok) {
                showToast(isRegisterMode ? 'Conta criada com sucesso' : 'Sessão iniciada com sucesso', 'success');
                if (authUsernameInput) authUsernameInput.value = '';
                if (authPasswordInput) authPasswordInput.value = '';
                await checkAuth();
            } else {
                showToast(result.message || 'Erro de acesso', 'delete');
            }
        } catch (err) {
            showToast('Não foi possível ligar ao servidor', 'delete');
        }
    }

    function startDemoMode() {
        // Demo mode removed - redirect to login
        window.location.href = '/';
    }

    async function handleLogout() {
        try {
            await fetch(getApiUrl('api/logout'), { method: 'POST', credentials: 'same-origin' });
        } catch (e) {}
        showToast('Sessão terminada', 'info');
        window.location.href = '/';
    }

    function saveToLocalStorage() {
        localStorage.setItem('mono_transactions', JSON.stringify(transactions));
        localStorage.setItem('mono_savings_target', savingsTarget.toString());
        localStorage.setItem('mono_recurring_expenses', JSON.stringify(recurringExpenses));
        localStorage.setItem('mono_savings_goals', JSON.stringify(savingsGoals));
    }

    async function handleImportLocal() {
        const localTransactions = localStorage.getItem('mono_transactions');
        const localSavingsTarget = localStorage.getItem('mono_savings_target');
        const localRecurring = localStorage.getItem('mono_recurring_expenses');
        const localGoals = localStorage.getItem('mono_savings_goals');

        if (!localTransactions && !localSavingsTarget && !localRecurring && !localGoals) {
            showToast('Sem dados locais para importar', 'info');
            return;
        }

        // Ask for user confirmation
        const confirmed = await showConfirm(
            'Importar dados locais',
            'Tem a certeza de que pretende importar os dados locais deste navegador? Isto irá substituir os seus dados no servidor.',
            'Importar',
            'Cancelar'
        );

        if (confirmed) {
            try {
                const data = {
                    transactions: localTransactions ? JSON.parse(localTransactions) : [],
                    savingsTarget: localSavingsTarget ? parseFloat(localSavingsTarget) : 10000.0,
                    recurringExpenses: localRecurring ? JSON.parse(localRecurring) : [],
                    savingsGoals: localGoals ? JSON.parse(localGoals) : []
                };

                const response = await fetch(getApiUrl('api/data'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showToast('Dados locais importados com sucesso', 'success');
                    transactions = data.transactions;
                    savingsTarget = data.savingsTarget;
                    recurringExpenses = data.recurringExpenses;
                    savingsGoals = data.savingsGoals;
                    renderAll();
                } else {
                    const result = await response.json();
                    showToast(result.message || 'Erro ao importar dados', 'delete');
                }
            } catch (e) {
                showToast('Erro ao ligar ao servidor', 'delete');
            }
        }
    }

    async function fetchUserData() {
        try {
            const response = await fetch(getApiUrl('api/data'), { credentials: 'same-origin' });
            if (response.ok) {
                const data = await response.json();
                let serverTxs = data.transactions || [];

                // Automatic Recovery: If server returns no transactions, restore transactions from LocalStorage cache
                if (serverTxs.length === 0) {
                    const localTxStr = localStorage.getItem('mono_transactions');
                    if (localTxStr) {
                        try {
                            const localTx = JSON.parse(localTxStr);
                            if (Array.isArray(localTx) && localTx.length > 0) {
                                serverTxs = localTx;
                                setTimeout(() => syncData(), 500);
                            }
                        } catch (e) {
                            console.warn('Could not parse local transactions fallback', e);
                        }
                    }
                }
                transactions = serverTxs;
                if (autoClassifyUncategorized()) {
                    setTimeout(() => syncData(), 300);
                }

                savingsTarget = data.savingsTarget !== undefined ? data.savingsTarget : 10000.0;
                dailyExpenseLimit = data.dailyExpenseLimit !== undefined ? data.dailyExpenseLimit : 1000.0;
                weeklyExpenseLimit = data.weeklyExpenseLimit !== undefined ? data.weeklyExpenseLimit : 7000.0;
                monthlyExpenseLimit = data.monthlyExpenseLimit !== undefined ? data.monthlyExpenseLimit : 30000.0;
                expenseLimitPeriod = data.expenseLimitPeriod || 'day';
                recurringExpenses = data.recurringExpenses || [];

                savingsGoals = Array.isArray(data.savingsGoals) ? data.savingsGoals : [];

                // Cache server data in LocalStorage for offline fallback
                saveToLocalStorage();

                // Check recurring debits on startup and render real user data
                processRecurringDebits();
                renderAll();
            } else if (response.status === 401) {
                showAuthScreen();
            } else {
                console.warn('Server data fetch returned status', response.status);
                loadLocalData();
            }
        } catch (e) {
            console.error('Failed to fetch user data, falling back to local storage data', e);
            loadLocalData();
        }
    }

    function autoClassifyUncategorized() {
        let changed = false;
        if (Array.isArray(transactions)) {
            transactions.forEach(t => {
                if (!t || !t.description) return;
                ensureTxType(t);
                const currentCat = t.category;
                const isUnset = !currentCat ||
                    currentCat === 'Despesa' ||
                    currentCat === 'Diversos' ||
                    currentCat === 'Outras despesas' ||
                    currentCat === 'Outros rendimentos' ||
                    currentCat === 'Entrada por voz';
                if (isUnset) {
                    const smartCat = getCategoryName(t.description, t.type);
                    if (smartCat && smartCat !== 'Outras despesas' && smartCat !== 'Outros rendimentos') {
                        t.category = smartCat;
                        changed = true;
                    }
                }
            });
        }
        return changed;
    }

    function saveToLocalStorage() {
        localStorage.setItem('mono_transactions', JSON.stringify(transactions));
        localStorage.setItem('mono_savings_target', savingsTarget);
        localStorage.setItem('mono_daily_expense_limit', dailyExpenseLimit);
        localStorage.setItem('mono_weekly_expense_limit', weeklyExpenseLimit);
        localStorage.setItem('mono_monthly_expense_limit', monthlyExpenseLimit);
        localStorage.setItem('mono_expense_limit_period', expenseLimitPeriod);
        localStorage.setItem('mono_recurring_expenses', JSON.stringify(recurringExpenses));
        localStorage.setItem('mono_savings_goals', JSON.stringify(savingsGoals));
    }

    function loadLocalData() {
        const savedTransactions = localStorage.getItem('mono_transactions');
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
        } else {
            transactions = [];
        }

        if (autoClassifyUncategorized()) {
            saveToLocalStorage();
        }

        const savedTarget = localStorage.getItem('mono_savings_target');
        if (savedTarget) {
            savingsTarget = parseFloat(savedTarget);
        }

        const savedDailyLimit = localStorage.getItem('mono_daily_expense_limit');
        if (savedDailyLimit) {
            dailyExpenseLimit = parseFloat(savedDailyLimit);
        }

        const savedWeeklyLimit = localStorage.getItem('mono_weekly_expense_limit');
        if (savedWeeklyLimit) {
            weeklyExpenseLimit = parseFloat(savedWeeklyLimit);
        }

        const savedMonthlyLimit = localStorage.getItem('mono_monthly_expense_limit');
        if (savedMonthlyLimit) {
            monthlyExpenseLimit = parseFloat(savedMonthlyLimit);
        }

        const savedPeriod = localStorage.getItem('mono_expense_limit_period');
        if (savedPeriod) {
            expenseLimitPeriod = savedPeriod;
        }

        const savedRecurring = localStorage.getItem('mono_recurring_expenses');
        if (savedRecurring) {
            recurringExpenses = JSON.parse(savedRecurring);
        }

        const savedGoals = localStorage.getItem('mono_savings_goals');
        if (savedGoals) {
            try {
                savingsGoals = JSON.parse(savedGoals);
                if (!Array.isArray(savingsGoals)) savingsGoals = [];
            } catch (e) {
                savingsGoals = [];
            }
        } else {
            savingsGoals = [];
        }

        processRecurringDebits();
        renderAll();
    }

    // Sync state changes to server
    async function syncData() {
        saveToLocalStorage();

        try {
            const response = await fetch(getApiUrl('api/data'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    transactions,
                    savingsTarget,
                    dailyExpenseLimit,
                    weeklyExpenseLimit,
                    monthlyExpenseLimit,
                    expenseLimitPeriod,
                    recurringExpenses,
                    savingsGoals
                })
            });
            if (!response.ok) throw new Error('Sync failed: ' + response.status);
        } catch (e) {
            console.error('Failed to sync changes with server', e);
            showToast('Erro de sincronização com o servidor', 'delete');
        }
    };

    // Seed Data Helper - removed (no demo data)
    const seedSampleData = () => {};

    // SPA Routing switch with direction parameter ('right' = slide from right, 'left' = slide from left)
    const switchView = (targetView, forceDirection) => {
        if (targetView === 'savings') {
            targetView = 'dashboard';
        }
        const viewOrder = ['dashboard', 'income', 'expenses', 'statistics'];
        const activeView = document.querySelector('.dashboard-view.active');
        let currentViewId = activeView ? activeView.id.replace('view-', '') : 'dashboard';

        let direction = forceDirection;
        if (!direction) {
            const currentIdx = viewOrder.indexOf(currentViewId);
            const targetIdx = viewOrder.indexOf(targetView);
            direction = (targetIdx >= currentIdx) ? 'right' : 'left';
        }

        sidebarNavItems.forEach(item => {
            if (item.dataset.view === targetView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            if (item.dataset.view === targetView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const views = document.querySelectorAll('.dashboard-view');
        views.forEach(view => {
            view.classList.remove('slide-from-right', 'slide-from-left');
            if (view.id === `view-${targetView}`) {
                view.classList.add('active');
                if (direction === 'right') {
                    view.classList.add('slide-from-right');
                } else {
                    view.classList.add('slide-from-left');
                }
            } else {
                view.classList.remove('active');
            }
        });

        // Always reset scroll position to top on mobile & desktop when switching screens
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        const mainContent = document.querySelector('main') || document.querySelector('.main-content') || document.getElementById('app-container');
        if (mainContent) {
            mainContent.scrollTop = 0;
        }

        const targetViewEl = document.getElementById(`view-${targetView}`);
        if (targetViewEl) {
            targetViewEl.scrollTop = 0;
        }

        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        });

        // Refresh all registries, charts, and metrics when switching views
        renderAll();
    };

    // 2. Render Functions
    const renderAll = () => {
        try {
            updateMonthSelectorUI();
            renderMetrics();
            renderDailyExpenseLimit();
            renderHistory();
            renderChart();
            renderRecurringExpenses();
            renderSavingsGoals();
            if (typeof updateExpenseAmountSuggestions === 'function') updateExpenseAmountSuggestions();
            if (typeof updateIncomeAmountSuggestions === 'function') updateIncomeAmountSuggestions();
        } catch (err) {
            console.error('Error during renderAll:', err);
        }
    };

    const getSelectedAndPrevMonthPrefixes = () => {
        const year = selectedYear;
        const month = selectedMonth;

        const currYearStr = year.toString();
        const currMonthStr = (month + 1).toString().padStart(2, '0');
        const currPrefix = `${currYearStr}-${currMonthStr}`;

        const prevDate = new Date(year, month - 1, 1);
        const prevYearStr = prevDate.getFullYear().toString();
        const prevMonthStr = (prevDate.getMonth() + 1).toString().padStart(2, '0');
        const prevPrefix = `${prevYearStr}-${prevMonthStr}`;

        return { currPrefix, prevPrefix };
    };

    const getCurrentAndPrevMonthPrefixes = () => {
        return getSelectedAndPrevMonthPrefixes();
    };

    const updateMonthSelectorUI = () => {
        const realNow = new Date();
        const realYear = realNow.getFullYear();
        const realMonth = realNow.getMonth();
        const realDay = realNow.getDate();
        const isCurrentRealMonth = (selectedYear === realYear && selectedMonth === realMonth);

        const monthLabel = `${UK_MONTH_NAMES[selectedMonth]} ${selectedYear}`;

        document.querySelectorAll('.selected-month-label').forEach(el => {
            el.textContent = monthLabel;
        });

        document.querySelectorAll('.btn-next-month').forEach(btn => {
            btn.disabled = isCurrentRealMonth;
        });

        document.querySelectorAll('.btn-reset-month').forEach(btn => {
            if (isCurrentRealMonth) {
                btn.classList.add('hidden');
            } else {
                btn.classList.remove('hidden');
            }
        });

        const prevDate = new Date(selectedYear, selectedMonth - 1, 1);

        const momSubtitle = document.getElementById('stats-mom-subtitle');
        if (momSubtitle) {
            if (isCurrentRealMonth) {
                momSubtitle.textContent = `${UK_MONTH_NAMES[selectedMonth]} (dia 1–${realDay} dia) vs ${UK_MONTH_NAMES[prevDate.getMonth()]} (dia 1–${realDay} dia)`;
            } else {
                momSubtitle.textContent = `${UK_MONTH_NAMES[selectedMonth]} ${selectedYear} vs ${UK_MONTH_NAMES[prevDate.getMonth()]}`;
            }
        }

        const chartSubtitle = document.getElementById('stats-chart-subtitle');
        if (chartSubtitle) {
            chartSubtitle.textContent = `Amplitude de entradas e saídas (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }

        const dbChartSubtitle = document.getElementById('db-chart-subtitle');
        if (dbChartSubtitle) {
            dbChartSubtitle.textContent = `Comparação de rendimentos e despesas (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }

        const categorySubtitle = document.getElementById('stats-category-subtitle');
        if (categorySubtitle) {
            categorySubtitle.textContent = `Despesas por categorias (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }

        const topSubtitle = document.getElementById('stats-top-subtitle');
        if (topSubtitle) {
            topSubtitle.textContent = `Maiores despesas (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }

        const incomeSubtitle = document.getElementById('stats-income-subtitle');
        if (incomeSubtitle) {
            incomeSubtitle.textContent = `Fontes de rendimento (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }

        const calendarSubtitle = document.getElementById('stats-calendar-subtitle');
        if (calendarSubtitle) {
            calendarSubtitle.textContent = `Distribuição calendário de despesas (${UK_MONTH_NAMES[selectedMonth]} ${selectedYear})`;
        }
    };

    const changeSelectedMonth = (delta) => {
        let newMonth = selectedMonth + delta;
        let newYear = selectedYear;

        if (newMonth < 0) {
            newMonth = 11;
            newYear -= 1;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear += 1;
        }

        const realNow = new Date();
        const realYear = realNow.getFullYear();
        const realMonth = realNow.getMonth();

        if (newYear > realYear || (newYear === realYear && newMonth > realMonth)) {
            return;
        }

        selectedYear = newYear;
        selectedMonth = newMonth;
        pickerYear = selectedYear;
        updateMonthSelectorUI();
        renderAll();
    };

    const resetToCurrentMonth = () => {
        const realNow = new Date();
        selectedYear = realNow.getFullYear();
        selectedMonth = realNow.getMonth();
        pickerYear = selectedYear;
        updateMonthSelectorUI();
        renderAll();
    };

    const getWeekDateRange = (d = new Date()) => {
        const current = new Date(d);
        const day = current.getDay();
        const diffToMon = current.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(current.setDate(diffToMon));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
            mondayStr: getLocalDateString(monday),
            sundayStr: getLocalDateString(sunday)
        };
    };

    const setLimitCarouselPeriod = (period, save = true) => {
        expenseLimitPeriod = period || 'day';
        const track = document.getElementById('limit-carousel-track');
        const dotDay = document.getElementById('limit-dot-day');
        const dotWeek = document.getElementById('limit-dot-week');
        const dotMonth = document.getElementById('limit-dot-month');

        if (track) {
            let offset = '0%';
            if (expenseLimitPeriod === 'week') offset = '-33.333333%';
            else if (expenseLimitPeriod === 'month') offset = '-66.666666%';
            track.style.transform = `translateX(${offset})`;
        }

        const activeDotClass = 'limit-carousel-dot px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-brand-purple text-white shadow-md transition-all';
        const inactiveDotClass = 'limit-carousel-dot px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#161619] border border-[#202024] text-brand-textSecondary hover:text-white transition-all';

        if (dotDay) dotDay.className = expenseLimitPeriod === 'day' ? activeDotClass : inactiveDotClass;
        if (dotWeek) dotWeek.className = expenseLimitPeriod === 'week' ? activeDotClass : inactiveDotClass;
        if (dotMonth) dotMonth.className = expenseLimitPeriod === 'month' ? activeDotClass : inactiveDotClass;

        if (save) {
            saveToLocalStorage();
            syncData();
        }
    };

    const renderDailyExpenseLimit = () => {
        // 1. Day Slide
        const daySpentEl = document.getElementById('day-limit-spent-display');
        const dayMaxEl = document.getElementById('day-limit-max-display');
        const dayBadgeEl = document.getElementById('day-limit-badge');
        const dayProgressEl = document.getElementById('day-limit-progress-fill');

        if (daySpentEl) {
            const todayStr = getLocalDateString(new Date());
            let daySum = 0;
            transactions.forEach(t => {
                if (t.type === 'expense' && t.date === todayStr) daySum += t.amount;
            });
            const dLimit = dailyExpenseLimit > 0 ? dailyExpenseLimit : 1000.0;
            const dPct = (daySum / dLimit) * 100;

            daySpentEl.textContent = formatCurrency(daySum);
            if (dayMaxEl) dayMaxEl.textContent = formatCurrency(dLimit);
            if (dayBadgeEl) {
                dayBadgeEl.textContent = `${dPct.toFixed(0)}%`;
                dayBadgeEl.className = dPct > 100
                    ? 'inline-flex px-2.5 py-0.5 rounded-full bg-[#2E1619] text-[#F87171] font-semibold text-[10px]'
                    : 'inline-flex px-2.5 py-0.5 rounded-full bg-brand-purpleDim text-brand-purple font-semibold text-[10px]';
            }
            if (dayProgressEl) {
                dayProgressEl.style.width = `${Math.min(100, dPct)}%`;
                dayProgressEl.className = dPct > 100
                    ? 'progress-thumb bg-gradient-to-r from-brand-purple via-[#20a034] to-[#EF4444] h-full rounded-full transition-all duration-500'
                    : 'progress-thumb bg-gradient-to-r from-brand-purple to-[#20a034] h-full rounded-full transition-all duration-500';
            }
        }

        // 2. Week Slide
        const weekSpentEl = document.getElementById('week-limit-spent-display');
        const weekMaxEl = document.getElementById('week-limit-max-display');
        const weekBadgeEl = document.getElementById('week-limit-badge');
        const weekProgressEl = document.getElementById('week-limit-progress-fill');

        if (weekSpentEl) {
            const { mondayStr, sundayStr } = getWeekDateRange();
            let weekSum = 0;
            transactions.forEach(t => {
                if (t.type === 'expense' && t.date >= mondayStr && t.date <= sundayStr) weekSum += t.amount;
            });
            const wLimit = weeklyExpenseLimit > 0 ? weeklyExpenseLimit : 7000.0;
            const wPct = (weekSum / wLimit) * 100;

            weekSpentEl.textContent = formatCurrency(weekSum);
            if (weekMaxEl) weekMaxEl.textContent = formatCurrency(wLimit);
            if (weekBadgeEl) {
                weekBadgeEl.textContent = `${wPct.toFixed(0)}%`;
                weekBadgeEl.className = wPct > 100
                    ? 'inline-flex px-2.5 py-0.5 rounded-full bg-[#2E1619] text-[#F87171] font-semibold text-[10px]'
                    : 'inline-flex px-2.5 py-0.5 rounded-full bg-brand-purpleDim text-brand-purple font-semibold text-[10px]';
            }
            if (weekProgressEl) {
                weekProgressEl.style.width = `${Math.min(100, wPct)}%`;
                weekProgressEl.className = wPct > 100
                    ? 'progress-thumb bg-gradient-to-r from-brand-purple via-[#20a034] to-[#EF4444] h-full rounded-full transition-all duration-500'
                    : 'progress-thumb bg-gradient-to-r from-brand-purple to-[#20a034] h-full rounded-full transition-all duration-500';
            }
        }

        // 3. Month Slide
        const monthSpentEl = document.getElementById('month-limit-spent-display');
        const monthMaxEl = document.getElementById('month-limit-max-display');
        const monthBadgeEl = document.getElementById('month-limit-badge');
        const monthProgressEl = document.getElementById('month-limit-progress-fill');

        if (monthSpentEl) {
            const { currPrefix } = getSelectedAndPrevMonthPrefixes();
            let monthSum = 0;
            transactions.forEach(t => {
                if (t.type === 'expense' && t.date && t.date.startsWith(currPrefix)) monthSum += t.amount;
            });
            const mLimit = monthlyExpenseLimit > 0 ? monthlyExpenseLimit : 30000.0;
            const mPct = (monthSum / mLimit) * 100;

            monthSpentEl.textContent = formatCurrency(monthSum);
            if (monthMaxEl) monthMaxEl.textContent = formatCurrency(mLimit);
            if (monthBadgeEl) {
                monthBadgeEl.textContent = `${mPct.toFixed(0)}%`;
                monthBadgeEl.className = mPct > 100
                    ? 'inline-flex px-2.5 py-0.5 rounded-full bg-[#2E1619] text-[#F87171] font-semibold text-[10px]'
                    : 'inline-flex px-2.5 py-0.5 rounded-full bg-brand-purpleDim text-brand-purple font-semibold text-[10px]';
            }
            if (monthProgressEl) {
                monthProgressEl.style.width = `${Math.min(100, mPct)}%`;
                monthProgressEl.className = mPct > 100
                    ? 'progress-thumb bg-gradient-to-r from-brand-purple via-[#20a034] to-[#EF4444] h-full rounded-full transition-all duration-500'
                    : 'progress-thumb bg-gradient-to-r from-brand-purple to-[#20a034] h-full rounded-full transition-all duration-500';
            }
        }

        setLimitCarouselPeriod(expenseLimitPeriod, false);
    };

    function ensureTxType(t) {
        if (!t) return;
        if (t.category === 'Envelopes' || (t.description && (t.description.startsWith('Depósito envelope') || t.description.startsWith('Levantamento envelope')))) {
            t.type = 'savings';
        }
    }

    function formatCalendarDailyAmount(val) {
        if (!val || val <= 0) return '';
        const isMobile = window.innerWidth < 640;
        if (isMobile) {
            if (val >= 100000) {
                return `${(val / 1000).toFixed(0)}k €`;
            } else if (val >= 10000) {
                const kVal = val / 1000;
                return `${kVal.toFixed(val % 1000 >= 100 ? 1 : 0)}k €`;
            } else {
                return `${Math.round(val)} €`;
            }
        } else {
            if (val >= 1000000) {
                return `${(val / 1000000).toFixed(1)}M €`;
            }
            return `${Math.round(val).toLocaleString('pt-PT')} €`;
        }
    }

    const renderMetrics = () => {
        // Retrieve selected & current month date parameters right at start
        const realNow = new Date();
        const realYear = realNow.getFullYear();
        const realMonth = realNow.getMonth();
        const realDay = realNow.getDate();

        const year = selectedYear;
        const month = selectedMonth;
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();

        const isCurrentMonth = (year === realYear && month === realMonth);
        const isPastMonth = (year < realYear) || (year === realYear && month < realMonth);
        const isFutureMonth = (year > realYear) || (year === realYear && month > realMonth);
        const currentDay = isCurrentMonth ? realDay : totalDays;
        const elapsedDays = isCurrentMonth ? Math.max(1, currentDay) : totalDays;

        let income = 0;
        let expenses = 0;

        transactions.forEach(t => {
            ensureTxType(t);
            if (t.type === 'income') {
                income += t.amount;
            } else if (t.type === 'expense') {
                expenses += t.amount;
            }
        });

        // Dynamic Month-over-Month trend computation (Income & Expenses vs previous month)
        const { currPrefix, prevPrefix } = getSelectedAndPrevMonthPrefixes();
        let currMonthIncome = 0;
        let prevMonthIncome = 0;
        let currMonthExpenses = 0;
        let prevMonthExpenses = 0;

        let currMtdIncome = 0;
        let prevMtdIncome = 0;
        let currMtdExpenses = 0;
        let prevMtdExpenses = 0;

        transactions.forEach(t => {
            if (!t.date) return;
            ensureTxType(t);
            const parts = t.date.split('-');
            if (parts.length !== 3) return;
            const tDay = parseInt(parts[2], 10);

            if (t.type === 'income') {
                if (t.date.startsWith(currPrefix)) {
                    currMonthIncome += t.amount;
                    if (!isCurrentMonth || tDay <= realDay) currMtdIncome += t.amount;
                } else if (t.date.startsWith(prevPrefix)) {
                    prevMonthIncome += t.amount;
                    if (!isCurrentMonth || tDay <= realDay) prevMtdIncome += t.amount;
                }
            } else if (t.type === 'expense') {
                if (t.date.startsWith(currPrefix)) {
                    currMonthExpenses += t.amount;
                    if (!isCurrentMonth || tDay <= realDay) currMtdExpenses += t.amount;
                } else if (t.date.startsWith(prevPrefix)) {
                    prevMonthExpenses += t.amount;
                    if (!isCurrentMonth || tDay <= realDay) prevMtdExpenses += t.amount;
                }
            }
        });

        // Compute goals summary across envelope goals
        let displaySavingsCurrent = 0;
        let displaySavingsTarget = 0;
        if (savingsGoals && savingsGoals.length > 0) {
            displaySavingsCurrent = savingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount) || 0), 0);
            displaySavingsTarget = savingsGoals.reduce((sum, g) => sum + (parseFloat(g.targetAmount) || 0), 0);
        }

        // Total balance: All Income - All Expenses (operations with envelopes do not affect the total balance)
        const balance = income - expenses;

        if (totalBalanceEl) totalBalanceEl.textContent = formatCurrency(balance);
        if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(currMonthIncome);
        if (totalExpensesEl) totalExpensesEl.textContent = formatCurrency(currMonthExpenses);
        if (totalSavingsEl) totalSavingsEl.textContent = formatCurrency(displaySavingsCurrent);

        // Update view totals (All-time registered totals on separate income and expenses ledger screens)
        if (tabIncomeTotalEl) tabIncomeTotalEl.textContent = formatCurrency(income);
        if (tabExpensesTotalEl) tabExpensesTotalEl.textContent = formatCurrency(expenses);

        // Savings goal progress percentage
        let progressPercent = 0;
        if (displaySavingsTarget > 0) {
            progressPercent = Math.min((displaySavingsCurrent / displaySavingsTarget) * 100, 100);
        }

        // Update Savings Screen Goal
        if (savingsCurrentEl) savingsCurrentEl.textContent = formatCurrency(displaySavingsCurrent);
        if (savingsTargetEl) savingsTargetEl.textContent = formatCurrency(displaySavingsTarget);
        if (goalProgressFillEl) goalProgressFillEl.style.width = `${progressPercent}%`;
        if (goalPercentageTextEl) goalPercentageTextEl.textContent = `${progressPercent.toFixed(0)}%`;

        // Update Dashboard Screen Goal
        if (dbSavingsCurrentEl) dbSavingsCurrentEl.textContent = formatCurrency(displaySavingsCurrent);
        if (dbSavingsTargetEl) dbSavingsTargetEl.textContent = formatCurrency(displaySavingsTarget);
        if (dbGoalProgressFillEl) dbGoalProgressFillEl.style.width = `${progressPercent}%`;

        const dbEnvelopesCountEl = document.getElementById('db-envelopes-count');
        if (dbEnvelopesCountEl) {
            const count = savingsGoals ? savingsGoals.length : 0;
            dbEnvelopesCountEl.textContent = `${count} ${count === 1 ? 'envelope' : (count >= 2 && count <= 4 ? 'envelopes' : 'envelopes')}`;
        }

        if (savingsBadgePctEl) {
            savingsBadgePctEl.textContent = `${progressPercent.toFixed(0)}%`;
        }

        // Income trend badge update
        const incomeTrendBadgeEl = document.getElementById('income-trend-badge');
        if (incomeTrendBadgeEl) {
            let incomePct = 0;
            const refPrev = prevMtdIncome > 0 ? prevMtdIncome : prevMonthIncome;
            const refCurr = currMtdIncome > 0 ? currMtdIncome : currMonthIncome;
            if (refPrev > 0) {
                incomePct = ((refCurr - refPrev) / refPrev) * 100;
            } else if (refCurr > 0) {
                incomePct = 100;
            }

            const prefix = incomePct > 0 ? '+' : '';
            incomeTrendBadgeEl.textContent = `${prefix}${incomePct.toFixed(1)}%`;

            if (incomePct >= 0) {
                incomeTrendBadgeEl.className = 'inline-flex px-2.5 py-0.5 rounded-full bg-brand-purpleDim text-brand-purple font-semibold text-[10px]';
            } else {
                incomeTrendBadgeEl.className = 'inline-flex px-2.5 py-0.5 rounded-full bg-[#2E1619] text-[#F87171] font-semibold text-[10px]';
            }
        }

        // Expenses trend badge update
        const expensesTrendBadgeEl = document.getElementById('expenses-trend-badge');
        if (expensesTrendBadgeEl) {
            let expensesPct = 0;
            const refPrev = prevMtdExpenses > 0 ? prevMtdExpenses : prevMonthExpenses;
            const refCurr = currMtdExpenses > 0 ? currMtdExpenses : currMonthExpenses;
            if (refPrev > 0) {
                expensesPct = ((refCurr - refPrev) / refPrev) * 100;
            } else if (refCurr > 0) {
                expensesPct = 100;
            }

            const prefix = expensesPct > 0 ? '+' : '';
            expensesTrendBadgeEl.textContent = `${prefix}${expensesPct.toFixed(1)}%`;

            // Expenses: Higher spending than last month is red, lower spending is positive (purple)
            if (expensesPct > 0) {
                expensesTrendBadgeEl.className = 'inline-flex px-2.5 py-0.5 rounded-full bg-[#2E1619] text-[#F87171] font-semibold text-[10px]';
            } else {
                expensesTrendBadgeEl.className = 'inline-flex px-2.5 py-0.5 rounded-full bg-brand-purpleDim text-brand-purple font-semibold text-[10px]';
            }
        }

        // Statistics view extra metrics & list update
        const avgExpenseDailyEl = document.getElementById('avg-expense-daily');
        const statsAvgSummaryEl = document.getElementById('stats-avg-summary');
        const dailyExpensesListContainer = document.getElementById('daily-expenses-list-container');

        const dates = [];
        const dailyExpenses = {};

        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = getLocalDateString(dateObj);
            dates.push(dateStr);
            dailyExpenses[dateStr] = 0;
        }

        let totalExpensesInCurrentMonth = 0;
        transactions.forEach(t => {
            if (t.type === 'expense' && dailyExpenses[t.date] !== undefined) {
                dailyExpenses[t.date] += t.amount;
                totalExpensesInCurrentMonth += t.amount;
            }
        });

        // Use elapsed days in month to get realistic average
        const avgDailyExpense = totalExpensesInCurrentMonth / elapsedDays;

        if (avgExpenseDailyEl) {
            avgExpenseDailyEl.textContent = formatCurrency(avgDailyExpense);
        }
        if (statsAvgSummaryEl) {
            statsAvgSummaryEl.textContent = formatCurrency(avgDailyExpense);
        }

        // 1. Forecast & Emergency Cushion
        const statsMonthlyForecastEl = document.getElementById('stats-monthly-forecast');
        const statsRunwayMonthsEl = document.getElementById('stats-runway-months');

        const remainingDays = isCurrentMonth ? (totalDays - elapsedDays) : 0;

        // Compute historical daily burn rate across all prior months (excluding savings transfers)
        let histTotalExpenses = 0;
        const histDaysSet = new Set();
        transactions.forEach(t => {
            ensureTxType(t);
            if (t.type === 'expense' && t.date && !t.date.startsWith(currPrefix)) {
                histTotalExpenses += t.amount;
                histDaysSet.add(t.date);
            }
        });

        const histActiveDays = Math.max(1, histDaysSet.size);
        let histDailyBurnRate = histTotalExpenses > 0 ? (histTotalExpenses / histActiveDays) : 0;
        if (histDailyBurnRate <= 0) {
            histDailyBurnRate = avgDailyExpense > 0 ? avgDailyExpense : 0;
        }

        // Dynamic weighted forecast
        // If no transactions at all, forecast should be 0
        const hasAnyData = totalExpensesInCurrentMonth > 0 || histTotalExpenses > 0;
        let forecastExpenses = totalExpensesInCurrentMonth;
        if (remainingDays > 0 && hasAnyData) {
            const weightCurrent = elapsedDays / totalDays;
            const weightHist = 1 - weightCurrent;
            const weightedDailyRate = (weightHist * histDailyBurnRate) + (weightCurrent * avgDailyExpense);
            forecastExpenses += (remainingDays * weightedDailyRate);
        }

        if (statsMonthlyForecastEl) {
            statsMonthlyForecastEl.textContent = formatCurrency(forecastExpenses);
        }

        const statsMonthlyForecastTitleEl = document.getElementById('stats-monthly-forecast-title');
        const statsMonthlyForecastSubtitleEl = document.getElementById('stats-monthly-forecast-subtitle');

        if (statsMonthlyForecastTitleEl) {
            if (isPastMonth) {
                statsMonthlyForecastTitleEl.textContent = 'Despesas do mês';
            } else if (isFutureMonth) {
                statsMonthlyForecastTitleEl.textContent = 'Previsão de despesas';
            } else {
                statsMonthlyForecastTitleEl.textContent = 'Previsão até fim do mês';
            }
        }

        if (statsMonthlyForecastSubtitleEl) {
            if (isPastMonth) {
                statsMonthlyForecastSubtitleEl.textContent = 'Total efetivo do mês';
            } else if (isFutureMonth) {
                statsMonthlyForecastSubtitleEl.textContent = 'Taxa esperada (histórico)';
            } else {
                statsMonthlyForecastSubtitleEl.textContent = 'Previsão ponderada';
            }
        }

        // Financial Safety Cushion (Подушка безпеки):
        // 1. Total liquid reserves = Liquid account balance (non-negative):
        const liquidBalance = Math.max(0, balance);
        const totalReserves = liquidBalance;

        // 2. Base monthly burn rate strictly on REAL CURRENT MONTH'S predicted forecast expense:
        const realPrefix = `${realYear}-${String(realMonth + 1).padStart(2, '0')}`;
        const realLastDay = new Date(realYear, realMonth + 1, 0).getDate();
        const realElapsed = Math.max(1, realDay);
        const realRemaining = realLastDay - realElapsed;

        let realCurrentExpenses = 0;
        let realPriorExpenses = 0;
        const realPriorDays = new Set();

        transactions.forEach(t => {
            ensureTxType(t);
            if (t.type === 'expense' && t.date) {
                if (t.date.startsWith(realPrefix)) {
                    realCurrentExpenses += t.amount;
                } else {
                    realPriorExpenses += t.amount;
                    realPriorDays.add(t.date);
                }
            }
        });

        const realCurrentDaily = realCurrentExpenses / realElapsed;
        const realPriorDaily = realPriorExpenses > 0 ? (realPriorExpenses / Math.max(1, realPriorDays.size)) : realCurrentDaily;

        let realCurrentForecast = realCurrentExpenses;
        if (realRemaining > 0) {
            const wCurr = realElapsed / realLastDay;
            const wHist = 1 - wCurr;
            const wDaily = (wHist * realPriorDaily) + (wCurr * realCurrentDaily);
            realCurrentForecast += (realRemaining * wDaily);
        }

        let monthlyBurnRate = realCurrentForecast;
        if (monthlyBurnRate <= 0) {
            monthlyBurnRate = realCurrentDaily > 0 ? (realCurrentDaily * 30.4) : (realPriorDaily > 0 ? (realPriorDaily * 30.4) : 0);
        }

        // 3. Compute exact runway days and months based on total reserves (liquid balance + envelopes) and real current month's predicted expense:
        let runwayMonths = 0;
        let runwayDays = 0;
        if (totalReserves > 0 && monthlyBurnRate > 0) {
            runwayMonths = totalReserves / monthlyBurnRate;
            runwayDays = Math.round(runwayMonths * 30.4);
        }

        if (statsRunwayMonthsEl) {
            if (totalReserves <= 0) {
                statsRunwayMonthsEl.textContent = '0 dias';
            } else if (runwayDays < 60) {
                statsRunwayMonthsEl.textContent = `${runwayDays} dias`;
            } else {
                const monthsVal = parseFloat(runwayMonths.toFixed(1));
                const getMonthDeclension = (num) => {
                    const label = num === 1 ? 'mês' : 'meses';
                    return `${num} ${label} (${runwayDays} dias)`;
                };
                statsRunwayMonthsEl.textContent = getMonthDeclension(monthsVal);
            }
        }

        // 2. Month-over-Month Comparison Panel
        const momIncomeVal = document.getElementById('stats-mom-income-val');
        const momIncomeBadge = document.getElementById('stats-mom-income-badge');
        const momExpensesVal = document.getElementById('stats-mom-expenses-val');
        const momExpensesBadge = document.getElementById('stats-mom-expenses-badge');
        const momNetVal = document.getElementById('stats-mom-net-val');
        const momNetBadge = document.getElementById('stats-mom-net-badge');

        if (momIncomeVal) momIncomeVal.textContent = formatCurrency(currMonthIncome);
        if (momExpensesVal) momExpensesVal.textContent = formatCurrency(currMonthExpenses);
        const currNet = currMonthIncome - currMonthExpenses;
        const prevNet = prevMonthIncome - prevMonthExpenses;
        if (momNetVal) momNetVal.textContent = formatCurrency(currNet);

        if (momIncomeBadge) {
            let incPct = prevMonthIncome > 0 ? ((currMonthIncome - prevMonthIncome) / prevMonthIncome) * 100 : (currMonthIncome > 0 ? 100 : 0);
            const pref = incPct > 0 ? '+' : '';
            momIncomeBadge.textContent = `${pref}${incPct.toFixed(1)}%`;
            momIncomeBadge.className = incPct >= 0
                ? 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-accentDim text-brand-accent'
                : 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2E1619] text-[#F87171]';
        }

        if (momExpensesBadge) {
            let expPct = prevMonthExpenses > 0 ? ((currMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100 : (currMonthExpenses > 0 ? 100 : 0);
            const pref = expPct > 0 ? '+' : '';
            momExpensesBadge.textContent = `${pref}${expPct.toFixed(1)}%`;
            momExpensesBadge.className = expPct > 0
                ? 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2E1619] text-[#F87171]'
                : 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-purpleDim text-brand-purple';
        }

        if (momNetBadge) {
            let netPct = prevNet !== 0 ? ((currNet - prevNet) / Math.abs(prevNet)) * 100 : (currNet > 0 ? 100 : 0);
            const pref = netPct > 0 ? '+' : '';
            momNetBadge.textContent = `${pref}${netPct.toFixed(1)}%`;
            momNetBadge.className = currNet >= 0
                ? 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-purpleDim text-brand-purple'
                : 'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2E1619] text-[#F87171]';
        }

        // 3. Category Breakdown
        const statsCategoryContainer = document.getElementById('stats-category-breakdown-container');
        const statsCategoryTotalEl = document.getElementById('stats-category-total');
        if (statsCategoryTotalEl) statsCategoryTotalEl.textContent = formatCurrency(totalExpensesInCurrentMonth);

        if (statsCategoryContainer) {
            statsCategoryContainer.innerHTML = '';
            const categorySums = {};
            transactions.forEach(t => {
                ensureTxType(t);
                if (t.type === 'expense' && t.date && t.date.startsWith(currPrefix)) {
                    const catName = (t.category && t.category !== 'Despesa' && t.category !== 'Diversos' && t.category !== 'Entrada por voz')
                        ? t.category
                        : getCategoryName(t.description, t.type);
                    categorySums[catName] = (categorySums[catName] || 0) + t.amount;
                }
            });

            const sortedCats = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
            if (sortedCats.length === 0) {
                statsCategoryContainer.innerHTML = '<p class="text-xs text-brand-textSecondary py-4 text-center">Sem despesas registadas no mês atual</p>';
            } else {
                sortedCats.forEach(([catName, sum]) => {
                    const pct = totalExpensesInCurrentMonth > 0 ? (sum / totalExpensesInCurrentMonth) * 100 : 0;
                    const catIcon = getCategoryIcon(catName, 'expense');
                    const row = document.createElement('div');
                    row.className = 'category-row-item space-y-1.5 p-3 rounded-2xl bg-[#161619]/60 border border-[#202024]/60 hover:border-brand-purple/80 hover:bg-[#161619] active:scale-[0.98] transition-all cursor-pointer group select-none';
                    row.dataset.category = catName;
                    row.dataset.date = currPrefix;
                    row.title = 'Clique para ver detalhes das despesas desta categoria';
                    row.innerHTML = `
                        <div class="flex justify-between items-center text-xs pointer-events-none">
                            <span class="text-white font-semibold flex items-center gap-2 group-hover:text-brand-purple transition-colors">
                                <span class="w-6 h-6 rounded-lg bg-brand-purpleDim border border-brand-purple/20 flex items-center justify-center text-brand-purple flex-shrink-0">
                                    <span class="material-symbols-outlined text-[14px]">${catIcon}</span>
                                </span>
                                <span class="truncate max-w-[170px] sm:max-w-[220px]">${escapeHtml(catName)}</span>
                            </span>
                            <span class="inline-flex items-center gap-1.5 bg-[#111113] border border-[#202024] px-2.5 py-1 rounded-xl text-xs">
                                <strong class="text-white font-outfit font-bold">${formatCurrency(sum)}</strong>
                                <span class="text-[10px] text-brand-textSecondary font-semibold">(${pct.toFixed(0)}%)</span>
                            </span>
                        </div>
                        <div class="progress-track bg-[#111113] h-2 w-full rounded-full border border-[#202024] overflow-hidden">
                            <div class="progress-thumb bg-gradient-to-r from-brand-purple to-[#20a034] h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
                        </div>
                    `;
                    row.addEventListener('click', () => openCategoryDetailsModal(catName));
                    statsCategoryContainer.appendChild(row);
                });
            }
        }

        // 4. Top 5 Expenses
        const statsTopExpensesContainer = document.getElementById('stats-top-expenses-container');
        if (statsTopExpensesContainer) {
            statsTopExpensesContainer.innerHTML = '';
            const monthExpenses = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(currPrefix));
            monthExpenses.sort((a, b) => b.amount - a.amount);
            const top5 = monthExpenses.slice(0, 5);

            if (top5.length === 0) {
                statsTopExpensesContainer.innerHTML = '<p class="text-xs text-brand-textSecondary py-4 text-center">Sem despesas no mês atual</p>';
            } else {
                top5.forEach((t, idx) => {
                    const item = document.createElement('div');
                    item.className = 'p-3 bg-[#161619] border border-[#202024] rounded-2xl flex items-center justify-between';
                    item.innerHTML = `
                        <div class="flex items-center gap-2.5 truncate max-w-[70%]">
                            <span class="w-5 h-5 rounded-full bg-brand-purpleDim text-brand-purple text-[10px] font-bold flex items-center justify-center flex-shrink-0">${idx + 1}</span>
                            <div class="truncate">
                                <p class="text-xs font-semibold text-white truncate">${escapeHtml(t.description)}</p>
                                <p class="text-[10px] text-brand-textSecondary truncate">${escapeHtml(t.category || 'Despesa')} • ${t.date}</p>
                            </div>
                        </div>
                        <span class="text-xs font-bold font-outfit text-[#20a034] flex-shrink-0">${formatCurrency(t.amount)}</span>
                    `;
                    statsTopExpensesContainer.appendChild(item);
                });
            }
        }

        // 5. Income Sources Breakdown
        const statsIncomeSourcesContainer = document.getElementById('stats-income-sources-container');
        if (statsIncomeSourcesContainer) {
            statsIncomeSourcesContainer.innerHTML = '';
            const incomeSums = {};
            let monthIncomeTotal = 0;
            transactions.forEach(t => {
                if (t.type === 'income' && t.date && t.date.startsWith(currPrefix)) {
                    const source = t.description || 'Outra fonte';
                    incomeSums[source] = (incomeSums[source] || 0) + t.amount;
                    monthIncomeTotal += t.amount;
                }
            });

            const sortedIncomes = Object.entries(incomeSums).sort((a, b) => b[1] - a[1]);
            if (sortedIncomes.length === 0) {
                statsIncomeSourcesContainer.innerHTML = '<p class="text-xs text-brand-textSecondary py-4 text-center">Sem rendimentos registados no mês atual</p>';
            } else {
                sortedIncomes.forEach(([sourceName, sum]) => {
                    const pct = monthIncomeTotal > 0 ? (sum / monthIncomeTotal) * 100 : 0;
                    const item = document.createElement('div');
                    item.className = 'p-3 bg-[#161619] border border-[#202024] rounded-2xl flex items-center justify-between';
                    item.innerHTML = `
                        <div class="truncate max-w-[65%]">
                            <p class="text-xs font-semibold text-white truncate">${escapeHtml(sourceName)}</p>
                            <p class="text-[10px] text-brand-textSecondary">${pct.toFixed(0)}% do rendimento</p>
                        </div>
                        <span class="text-xs font-bold font-outfit text-brand-accent flex-shrink-0">${formatCurrency(sum)}</span>
                    `;
                    statsIncomeSourcesContainer.appendChild(item);
                });
            }
        }

        if (dailyExpensesListContainer) {
            dailyExpensesListContainer.innerHTML = '';

            // Create calendar grid layout container
            const calendarGrid = document.createElement('div');
            calendarGrid.className = 'grid grid-cols-7 gap-1 sm:gap-2.5 mt-4 w-full min-w-0';

            // Add wrapper for horizontal scroll on mobile
            const outerWrapper = document.createElement('div');
            outerWrapper.className = 'w-full overflow-x-auto sm:overflow-visible custom-scrollbar pb-2';
            outerWrapper.appendChild(calendarGrid);
            dailyExpensesListContainer.appendChild(outerWrapper);

            // Add column headers (Days of the week)
            const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            weekdays.forEach(day => {
                const header = document.createElement('div');
                header.className = 'text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-brand-textSecondary pb-2 border-b border-[#202024]/50';
                header.textContent = day;
                calendarGrid.appendChild(header);
            });

            // Get first day of the month
            const firstDayObj = new Date(year, month, 1);
            let startDayOfWeek = firstDayObj.getDay();
            if (startDayOfWeek === 0) startDayOfWeek = 6; // Sunday
            else startDayOfWeek = startDayOfWeek - 1; // Shift Monday to 0, etc.

            // Render empty cells for previous month padding
            for (let i = 0; i < startDayOfWeek; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'bg-[#111113]/5 border border-transparent min-h-[50px] sm:min-h-[90px] rounded-xl sm:rounded-2xl';
                calendarGrid.appendChild(emptyCell);
            }

            // Find max daily expense
            let maxDailyExpense = 0;
            dates.forEach(d => {
                if (dailyExpenses[d] > maxDailyExpense) maxDailyExpense = dailyExpenses[d];
            });
            maxDailyExpense = maxDailyExpense || 1;

            // Render active month cells
            for (let d = 1; d <= totalDays; d++) {
                const dateObj = new Date(year, month, d);
                const dateStr = getLocalDateString(dateObj);
                const amount = dailyExpenses[dateStr] || 0;

                const isToday = isCurrentMonth && (d === realDay);
                const isFuture = isCurrentMonth && (d > realDay);
                const hasExpenses = amount > 0;

                const cell = document.createElement('div');

                // Styling classes
                let bgClass = 'bg-[#111113]/30 border-[#202024]/30 hover:border-brand-border';
                let dayBadgeClass = 'text-brand-textSecondary opacity-60';
                let amountClass = 'hidden';
                let hoverClass = 'hover:bg-[#161619]/40';

                if (hasExpenses) {
                    bgClass = 'bg-[#2E1B18]/15 border-brand-accent/20 hover:border-brand-accent/50';
                    dayBadgeClass = 'text-white font-semibold';

                    let amountFontSize = 'text-[7.5px] sm:text-xs';
                    if (amount >= 10000) {
                        amountFontSize = 'text-[6.5px] sm:text-[10px]';
                    } else if (amount >= 1000) {
                        amountFontSize = 'text-[7px] sm:text-[11px]';
                    }
                    amountClass = `text-brand-accent font-outfit ${amountFontSize} font-bold leading-tight mt-0.5 sm:mt-1.5 w-full text-right truncate block calendar-day-amount`;
                    hoverClass = 'hover:bg-[#2E1B18]/25';
                }

                if (isToday) {
                    bgClass = 'bg-[#161619] border-brand-purple/70 ring-1 ring-brand-purple/20';
                    dayBadgeClass = 'bg-brand-purple text-white px-1 sm:px-2 py-0.5 rounded-md text-[8px] sm:text-xs font-bold';
                    hoverClass = 'hover:bg-[#1C1C20]';
                }

                if (isFuture) {
                    bgClass = 'bg-[#111113]/10 border-[#202024]/20 opacity-30';
                    hoverClass = '';
                }

                cell.className = `border rounded-xl sm:rounded-2xl p-1 sm:p-2.5 flex flex-col justify-between min-h-[50px] sm:min-h-[90px] transition-all duration-200 overflow-hidden ${isFuture ? '' : 'cursor-pointer'} ${bgClass} ${hoverClass}`;

                const formattedAmount = formatCalendarDailyAmount(amount);

                cell.innerHTML = `
                    <div class="flex justify-between items-center w-full">
                        <span class="${isToday ? dayBadgeClass : 'text-[8px] sm:text-xs ' + dayBadgeClass}">${d}</span>
                    </div>
                    <div class="${amountClass}" title="${amount > 0 ? formatCurrency(amount) : ''}">
                        ${amount > 0 ? formattedAmount : ''}
                    </div>
                `;

                // Add click handler to show daily expenses popup details
                if (!isFuture) {
                    cell.addEventListener('click', () => {
                        // Filter expenses for this date
                        const dayExpenses = transactions.filter(t => t.type === 'expense' && t.date === dateStr);

                        // Format date nicely in Ukrainian
                        const formattedDateStr = dateObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
                        if (dailyModalDate) dailyModalDate.textContent = formattedDateStr;

                        if (dailyModalList) {
                            dailyModalList.innerHTML = '';

                            if (dayExpenses.length === 0) {
                                const emptyMsg = document.createElement('div');
                                emptyMsg.className = 'text-center py-8 text-brand-textSecondary text-xs opacity-60';
                                emptyMsg.textContent = 'Sem despesas neste dia';
                                dailyModalList.appendChild(emptyMsg);
                            } else {
                                dayExpenses.forEach(t => {
                                    const itemEl = document.createElement('div');
                                    itemEl.className = 'flex justify-between items-center p-3.5 bg-black/40 border border-[#202024]/50 rounded-xl hover:border-brand-purple/40 transition-all';

                                    const iconName = getCategoryIcon(t.description, t.type);
                                    const categoryName = getCategoryName(t.description, t.type);

                                    itemEl.innerHTML = `
                                        <div class="flex items-center gap-3">
                                            <span class="material-symbols-outlined text-[18px] text-brand-purple bg-brand-purpleDim p-2 rounded-lg">${iconName}</span>
                                            <div>
                                                <p class="text-xs font-semibold text-white">${t.description}</p>
                                                <p class="text-[9px] text-brand-textSecondary mt-0.5">${categoryName}</p>
                                            </div>
                                        </div>
                                        <span class="font-outfit font-bold text-xs text-white">${formatCurrency(t.amount)}</span>
                                    `;
                                    dailyModalList.appendChild(itemEl);
                                });
                            }
                        }

                        // Update total spent
                        const totalSpent = dayExpenses.reduce((sum, t) => sum + t.amount, 0);
                        if (dailyModalTotal) dailyModalTotal.textContent = formatCurrency(totalSpent);

                        // Open modal
                        if (dailyDetailsModal) {
                            dailyDetailsModal.classList.add('active');
                        }
                    });
                }

                calendarGrid.appendChild(cell);
            }
        }

        // Update financial insights in dashboard
        const dbInsightSavingRate = document.getElementById('db-insight-saving-rate');
        const dbInsightGoalProgress = document.getElementById('db-insight-goal-progress');
        const dbInsightGoalProgressFill = document.getElementById('db-insight-goal-progress-fill');
        const dbInsightStatus = document.getElementById('db-insight-status');
        const dbInsightAdvice = document.getElementById('db-insight-advice');

        const rate = income > 0 ? (displaySavingsCurrent / income) * 100 : 0;
        if (dbInsightSavingRate) {
            dbInsightSavingRate.textContent = `${rate.toFixed(0)}%`;
        }
        if (dbInsightGoalProgress) {
            dbInsightGoalProgress.textContent = `${progressPercent.toFixed(0)}%`;
        }
        if (dbInsightGoalProgressFill) {
            dbInsightGoalProgressFill.style.width = `${progressPercent}%`;
        }

        if (dbInsightStatus) {
            if (balance > 0) {
                dbInsightStatus.textContent = 'Positivo';
                dbInsightStatus.className = 'text-xs font-bold text-brand-accent';
            } else if (balance === 0) {
                dbInsightStatus.textContent = 'Equilibrado';
                dbInsightStatus.className = 'text-xs font-bold text-brand-purple';
            } else {
                dbInsightStatus.textContent = 'Défice';
                dbInsightStatus.className = 'text-xs font-bold text-red-500';
            }
        }

        if (dbInsightAdvice) {
            if (balance < 0) {
                dbInsightAdvice.textContent = 'As suas despesas ultrapassam os rendimentos. Recomenda-se rever despesas não essenciais.';
            } else if (balance === 0) {
                dbInsightAdvice.textContent = 'O saldo de rendimentos e despesas está equilibrado. Acompanhe as despesas planeadas.';
            } else {
                dbInsightAdvice.textContent = 'Excelente dinâmica! O orçamento está positivo, rendimentos superam despesas.';
            }
        }
    };
    const EXPENSE_STEM_MAP = {
        "Кафе та ресторани": [
            "макдональдз", "mcdonald", "кфс", "kfc", "піца", "піцері", "pizza", "суші", "sushi", "рол",
            "бургер", "burger", "шаурм", "шаверм", "донер", "кебаб", "фалафель", "сендвіч", "хот-дог",
            "хотдог", "вок", "рамен", "том ям", "боул", "кав'ярн", "кава", "кавус", "coffee", "cafe",
            "латте", "лате", "капучино", "американо", "еспресо", "флет вайт", "раф", "глясе", "матча",
            "ресторан", "кафе", "ланч", "обід", "сніданок", "вечер", "перекус", "бізнес ланч", "столов",
            "їдальн", "паб", "бар", "коктейль", "пиво", "сидр", "кальян", "заклад", "глово", "glovo",
            "bolt food", "доставка їж", "кур'єр їж"
        ],
        "Продукти харчування": [
            "бул", "булочк", "булк", "хліб", "батон", "круас", "пиріж", "пирог", "кекс", "мафін",
            "пончик", "донат", "лаваш", "багет", "паск", "бублик", "рогалик", "сухар", "грінк", "випіч",
            "пекарн", "чіабат", "паніні", "печив", "вафл", "торт", "тістеч", "пряник", "шоколад",
            "цукер", "солод", "зефір", "мармелад", "халв", "пастил", "льодяник", "карамел", "батончик",
            "морозив", "згущен", "м'яс", "мяс", "філе", "фарш", "стейк", "биточ", "котлет", "гуляш",
            "шашлик", "відбивн", "ковбас", "сосис", "сардел", "шинк", "бужен", "балик", "бекон", "сало",
            "курк", "куряч", "птиц", "індич", "качк", "гомілк", "крильц", "стегн", "ялович", "свинин",
            "телятин", "баранин", "риб", "форел", "лосос", "сьомг", "тунец", "тунц", "скумбр", "оселед",
            "хек", "минтай", "краб", "кревет", "міді", "кальмар", "морепрод", "ікр", "сир", "молок",
            "молоч", "масл", "смет", "йогурт", "кефір", "ряжанк", "вершк", "творог", "бринз", "сулугун",
            "пармезан", "моцарел", "яйц", "яєч", "овоч", "помідор", "томат", "огірок", "огірк", "капуст",
            "моркв", "буряк", "цибул", "часник", "перец", "перч", "картоп", "барабол", "пюре", "кабач",
            "баклаж", "гриб", "печериц", "зелен", "петруш", "кріп", "шпинат", "рукол", "фрукт", "яблук",
            "яблуч", "груш", "банан", "апельсин", "мандарин", "цитрус", "лимон", "лайм", "грейп", "персик",
            "нектарин", "абрикос", "слив", "виног", "хурм", "ківі", "ананас", "манго", "авокадо", "ягод",
            "полуниц", "клубнік", "малин", "лохин", "чорниц", "смородин", "порічк", "черешн", "вишн",
            "кавун", "дин", "макарон", "спагет", "вермішел", "круп", "гречк", "рис", "вівсян", "пшон",
            "булгур", "кускус", "кіноа", "горох", "квасол", "сочевиц", "кукурудз", "борос", "мук", "цукор",
            "цукр", "сіл", "олі", "оцет", "соус", "кетчуп", "майонез", "гірчиц", "спеці", "приправ",
            "снек", "чипс", "чіпс", "горіх", "горішк", "арахіс", "фундук", "мигдал", "кеш'ю", "кешью",
            "насін", "сім'я", "попкорн", "вод", "водичк", "мінералк", "сік", "сочок", "морс", "компот",
            "узвар", "квас", "лимонад", "кол", "пепс", "спрайт", "фант", "напі", "енергетик", "чай",
            "чайок", "какао", "цикорій", "супермарк", "маркет", "продукт", "гастрон", "магазин", "пакет",
            "купув", "їж", "харч", "пожив", "сільпо", "атб", "ашан", "варус", "фора", "metro", "novus",
            "траш", "кишеня", "таврія", "екомаркет", "ринок", "базар", "ларьок", "кіоск"
        ],
        "Транспорт та Авто": [
            "проїзд", "проїзн", "квиток", "талон", "метро", "автобус", "маршрутк", "тролейбус", "трамвай",
            "електричк", "поїзд", "потяг", "укрзалізниц", "інтерсіті", "вокзал", "таксі", "taxi", "uber",
            "убер", "uklon", "уклон", "bolt", "драйвер", "поїздк", "бензин", "дизель", "дт", "газ на авто",
            "пальн", "заправк", "азс", "окко", "wog", "socar", "upg", "брсм", "авіас", "shell", "автомийк",
            "автомийн", "мийка авто", "шиномонтаж", "сто", "ремонт авто", "запчастин", "детал", "масло моторн",
            "страховк", "осаго", "каско", "парковк", "паркінг", "штраф", "пдр", "прокат", "каршерінг",
            "самокат", "скутер", "байк", "велосипед", "авто", "машин"
        ],
        "Комунальні та Житло": [
            "комунал", "квартплат", "оренд", "rent", "житл", "квартир", "світл", "електроенерг", "дтек",
            "dtek", "ясно", "yasno", "газ", "нафтогаз", "водоканал", "гаряча вода", "холодна вода", "опален",
            "теплоенерг", "осбб", "жек", "смітт", "домофон", "інтернет", "провайдер", "роутер", "київстар дім",
            "воля", "ланет", "сантехнік", "електрик", "ремонт дім", "ремонт кварт", "будматеріал", "епіцентр",
            "леруа", "мебл", "ikea", "ікеа", "юск", "jysk", "господарсь", "побутова хім", "порошок", "миючий"
        ],
        "Здоров'я та Спорт": [
            "аптек", "ліки", "таблетк", "вітамін", "мазь", "крапл", "сироп", "антибіотик", "знеболюв",
            "бад", "пластир", "бинт", "термометр", "лікар", "клінік", "поліклінік", "лікарн", "госпітал",
            "прийом лікар", "консультаці", "аналіз", "сінево", "synevo", "діла", "dila", "узд", "мрт",
            "кт", "рентген", "стоматолог", "зуб", "пломб", "чистка зуб", "брекет", "окуліст", "зір",
            "окуляр", "лінз", "масаж", "терапі", "вакцин", "спорт", "gym", "fitness", "фітнес", "зал",
            "тренуван", "абонемент", "тренер", "басейн", "йог", "пілатес", "спорткомплекс", "спортінвентар",
            "протеїн", "гейнер", "гантел"
        ],
        "Покупки та Одяг": [
            "одяг", "взутт", "кросівк", "черевик", "туфл", "босоніжк", "куртк", "пальто", "пуховик",
            "вітровк", "джинс", "штани", "брюк", "футболк", "сорочк", "худі", "світшот", "светр",
            "кофт", "шорт", "платт", "сукн", "спідниц", "білизн", "шкарпетк", "шапк", "шарф", "рукавичк",
            "кепк", "сумк", "рюкзак", "гаманець", "ремін", "zara", "h&m", "bershka", "pull&bear",
            "mango", "stradivarius", "інтертоп", "intertop", "шопінг", "технік", "електронік", "ноутбук",
            "комп'ютер", "компютер", "монітор", "клавіатур", "мишк", "навушник", "airpods", "смартфон",
            "телефон", "iphone", "айфон", "чохол", "скло", "зарядк", "павербанк", "кабел", "планшет",
            "ipad", "годинник", "apple watch", "гаджет", "косметик", "парфум", "духи", "крем", "шампун",
            "гель для душ", "мило", "зубна паст", "щітк", "бритв", "дезодорант", "перукарн", "барбер",
            "барбершоп", "стрижк", "манікюр", "педикюр", "бров", "вії", "косметолог", "солярій",
            "подарунок", "квіт", "букет", "книг", "книжк", "канцеляр", "зоотовар", "корм для", "кіт",
            "котик", "собак", "ветклінік", "покупк", "придбав", "купив"
        ],
        "Розваги та Дозвілля": [
            "кіно", "кінотеатр", "фільм", "мультиплекс", "планета кіно", "театр", "вистав", "концерт",
            "фестиваль", "музей", "виставк", "боулінг", "більярд", "квест", "пейнтбол", "атракціон",
            "зоопарк", "аквапарк", "парк розваг", "ігр", "гра", "steam", "стим", "playstation", "ps store",
            "psn", "xbox", "nintendo", "epic games", "геймінг", "підписк", "подпіск", "subscription",
            "netflix", "spotify", "youtube premium", "apple music", "megogo", "sweet tv", "patreon",
            "telegram premium", "хобі", "настілк", "подорож", "туризм", "відпочинок", "готель",
            "hotel", "booking", "airbnb"
        ]
    };

    const INCOME_STEM_MAP = {
        "Зарплата": ["зарплат", "salary", "робот", "аванс", "стипенд", "ставка", "получка"],
        "Премії та Чайові": ["чайов", "tip", "бонус", "премі", "подарунок"],
        "Інвестиції та Кешбек": ["дивіденд", "dividend", "акці", "інвест", "кешбек", "cashback", "повернен", "відсотк", "депозит", "крипт"],
        "Фріланс та Проєкти": ["фріланс", "freelance", "проєкт", "проект", "замовленн", "контракт", "розробк", "дизайн", "копірайт", "клієнт"]
    };

    const CATEGORY_ICON_MAP = {
        "Продукти харчування": "shopping_cart",
        "Кафе та ресторани": "restaurant",
        "Транспорт та Авто": "directions_car",
        "Комунальні та Житло": "home",
        "Здоров'я та Спорт": "fitness_center",
        "Покупки та Одяг": "shopping_bag",
        "Розваги та Дозвілля": "movie",
        "Outras despesas": "receipt_long",
        "Salário": "work",
        "Freelance e projetos": "computer",
        "Prémios e gorjetas": "redeem",
        "Investimentos e cashback": "trending_up",
        "Outros rendimentos": "payments",
        "Envelopes": "account_balance_wallet"
    };

    function findSimilarHistoricalCategory(desc, type) {
        if (!desc || !Array.isArray(transactions) || transactions.length === 0) return null;
        const cleanDesc = String(desc).toLowerCase().trim();
        if (!cleanDesc) return null;

        const inputTokens = cleanDesc.split(/[\s,.;:!?+*\/\\-_()]+/).filter(w => w.length >= 2);
        let bestMatch = null;
        let highestScore = 0;

        for (const t of transactions) {
            if (!t || t.type !== type || !t.description) continue;
            const validCat = (t.category && t.category !== 'Despesa' && t.category !== 'Diversos' && t.category !== 'Outras despesas' && t.category !== 'Outros rendimentos' && t.category !== 'Entrada por voz') ? t.category : null;
            if (!validCat) continue;

            const histDesc = String(t.description).toLowerCase().trim();
            if (histDesc === cleanDesc) return validCat;

            if (histDesc.includes(cleanDesc) || cleanDesc.includes(histDesc)) {
                if (0.85 > highestScore) {
                    highestScore = 0.85;
                    bestMatch = validCat;
                }
            }

            const histTokens = histDesc.split(/[\s,.;:!?+*\/\\-_()]+/).filter(w => w.length >= 2);
            if (histTokens.length > 0 && inputTokens.length > 0) {
                let shared = 0;
                for (const it of inputTokens) {
                    for (const ht of histTokens) {
                        if (it === ht || (it.length >= 4 && ht.startsWith(it.substring(0, 4))) || (ht.length >= 4 && it.startsWith(ht.substring(0, 4)))) {
                            shared++;
                            break;
                        }
                    }
                }
                const tokenScore = shared / Math.max(inputTokens.length, histTokens.length);
                if (tokenScore > highestScore && tokenScore >= 0.4) {
                    highestScore = tokenScore;
                    bestMatch = validCat;
                }
            }
        }
        return bestMatch;
    }

    function getCategoryName(desc, type) {
        const d = desc ? String(desc).toLowerCase().trim() : '';
        if (!d) return type === 'income' ? 'Outros rendimentos' : 'Outras despesas';
        if (d.includes('envelope')) return 'Envelopes';

        // 1. Check historical similarity first
        const histCat = findSimilarHistoricalCategory(desc, type);
        if (histCat) return histCat;

        // 2. Semantic matching with lowered threshold
        if (type === 'income') {
            for (const [cat, stems] of Object.entries(INCOME_STEM_MAP)) {
                if (stems.some(s => d.includes(s))) return cat;
            }
            return 'Outros rendimentos';
        } else if (type === 'expense') {
            const scores = {};
            for (const [cat, stems] of Object.entries(EXPENSE_STEM_MAP)) {
                let score = 0;
                for (const s of stems) {
                    if (d.includes(s)) score++;
                }
                if (score > 0) scores[cat] = score;
            }

            if (Object.keys(scores).length > 0) {
                let bestCat = 'Outras despesas';
                let maxScore = 0;
                for (const [cat, score] of Object.entries(scores)) {
                    if (score > maxScore) {
                        maxScore = score;
                        bestCat = cat;
                    }
                }
                return bestCat;
            }
            return 'Outras despesas';
        } else {
            return 'Poupança';
        }
    }

    function getCategoryIcon(catOrDesc, type) {
        if (!catOrDesc) return type === 'income' ? 'payments' : (type === 'savings' ? 'shield' : 'receipt_long');
        const str = String(catOrDesc).trim();
        if (CATEGORY_ICON_MAP[str]) return CATEGORY_ICON_MAP[str];

        const calculated = getCategoryName(str, type);
        if (CATEGORY_ICON_MAP[calculated]) return CATEGORY_ICON_MAP[calculated];

        if (type === 'income') return 'payments';
        if (type === 'savings') return 'shield';
        return 'receipt_long';
    }

    const renderLedger = (listElId, typeFilter, isRecentOnly) => {
        const listEl = document.getElementById(listElId);
        if (!listEl) return;
        listEl.innerHTML = '';

        const mobileListElId = 'mobile-' + listElId.replace('ledger-', '');
        const mobileListEl = document.getElementById(mobileListElId);
        if (mobileListEl) mobileListEl.innerHTML = '';

        let filtered = transactions.filter(t => {
            if (!t) return false;
            ensureTxType(t);

            let matchesType = false;
            if (typeFilter === 'savings') {
                matchesType = t.type === 'savings' ||
                    t.category === 'Envelopes' ||
                    (t.description && t.description.toLowerCase().includes('envelope'));
            } else {
                matchesType = typeFilter === 'all' || t.type === typeFilter;
            }

            const desc = (t.description || '').toLowerCase();
            const tType = (t.type || '').toLowerCase();
            const q = (searchQuery || '').toLowerCase().trim();
            const matchesSearch = !q || desc.includes(q) || tType.includes(q);

            return matchesType && matchesSearch;
        });

        // Sort chronologically (newest first, newest transaction first if same date)
        filtered.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;

            // Extract numeric timestamp safely (first 13 digits)
            const parseIdNum = (idStr) => {
                const digits = String(idStr || '').replace(/[^0-9]/g, '').slice(0, 13);
                return parseFloat(digits) || 0;
            };

            return parseIdNum(b.id) - parseIdNum(a.id);
        });

        if (listElId === 'ledger-income-list') {
            filtered = filtered.slice(0, 6);
        } else if (listElId === 'ledger-expenses-list') {
            filtered = filtered.slice(0, 17);
        } else if (isRecentOnly) {
            filtered = filtered.slice(0, 10);
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-brand-textSecondary opacity-50">Sem transações no período selecionado</td>
                </tr>`;
            if (mobileListEl) {
                mobileListEl.innerHTML = `<div class="py-12 text-center text-brand-textSecondary opacity-50 text-xs">Sem transações no período selecionado</div>`;
            }
            return;
        }

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = `hover:bg-[#161619] transition-colors group`;

            const prefix = t.type === 'income' ? '+' : '-';
            let badgeLabel = t.type === 'income' ? 'Rendimento' : (t.type === 'expense' ? 'Despesa' : 'Poupança');
            if (t.category === 'Envelopes' || (t.description && t.description.toLowerCase().includes('envelope'))) {
                badgeLabel = t.type === 'income' ? 'Levantamento envelope' : 'Depósito envelope';
            }

            const iconName = getCategoryIcon(t.category || t.description, t.type);

            // Set accent colors based on type
            let iconBgClass = 'bg-[#1C1C1F] text-white';
            if (t.type === 'income') {
                iconBgClass = 'bg-brand-accentDim text-brand-accent';
            } else if (t.type === 'expense') {
                iconBgClass = 'bg-brand-purpleDim text-brand-purple';
            } else if (t.type === 'savings') {
                iconBgClass = 'bg-brand-savingsDim text-blue-400';
            }

            tr.innerHTML = `
                <td class="py-4 px-3 text-brand-textSecondary font-medium text-xs">${formatDateString(t.date)}</td>
                <td class="py-4 px-3 font-semibold flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg ${iconBgClass} border border-[#202024] flex items-center justify-center group-hover:border-[#20a034] transition-colors">
                        <span class="material-symbols-outlined text-[16px]">${iconName}</span>
                    </span>
                    <span class="truncate max-w-[150px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</span>
                </td>
                <td class="py-4 px-3 text-brand-textSecondary font-semibold text-xs hidden sm:table-cell">${badgeLabel}</td>
                <td class="py-4 px-3 text-xs hidden sm:table-cell">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#202024] text-[9px] uppercase tracking-widest font-semibold text-white">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Concluído
                    </span>
                </td>
                <td class="py-4 px-3 text-right font-outfit text-base font-semibold tracking-tight ${t.type === 'income' ? 'text-brand-accent' : 'text-white'}">${prefix}${formatCurrency(t.amount)}</td>
                <td class="py-4 px-3 text-right">
                    <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </td>
            `;

            // Delete Event
            tr.querySelector('.delete-button').addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                handleDeleteTransaction(id);
            });

            listEl.appendChild(tr);

            // Render mobile list card
            if (mobileListEl) {
                const card = document.createElement('div');
                card.className = 'bg-[#161619] border border-[#202024] p-4 rounded-2xl flex items-center justify-between hover:border-brand-purple transition-all group';

                card.innerHTML = `
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-10 h-10 rounded-xl ${iconBgClass} border border-[#202024] flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-[18px]">${iconName}</span>
                        </span>
                        <div class="min-w-0">
                            <p class="font-semibold text-sm text-white truncate max-w-[160px] flex items-center"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</p>
                            <p class="text-[10px] text-brand-textSecondary font-medium mt-0.5">${formatDateString(t.date)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-outfit text-sm font-semibold tracking-tight ${t.type === 'income' ? 'text-brand-accent' : 'text-white'}">${prefix}${formatCurrency(t.amount)}</span>
                        <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                `;

                // Delete Event for mobile card
                card.querySelector('.delete-button').addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    handleDeleteTransaction(id);
                });

                mobileListEl.appendChild(card);
            }
        });
    };

    const updateFilterPillPosition = (filterName) => {
        const pill = document.getElementById('filter-tabs-pill-indicator');
        const activeTab = document.querySelector(`.filter-tab[data-filter="${filterName}"]`);
        const container = document.querySelector('.filter-tabs');
        if (!pill || !activeTab || !container) return;

        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();

        const offsetLeft = tabRect.left - containerRect.left;
        const width = tabRect.width;

        pill.style.transform = `translateX(${offsetLeft}px)`;
        pill.style.width = `${width}px`;
        pill.setAttribute('data-active-filter', filterName);
    };

    const renderHistory = (swipeDirection) => {
        // Main ledger (in Dashboard overview, limited to last 10, filters by tab + search)
        renderLedger('history-list', currentFilter, true);

        // Savings ledger (savings view, all items, filter by search)
        renderLedger('ledger-savings-list', 'savings', false);

        // Income ledger (income view, all items, filter by search)
        renderLedger('ledger-income-list', 'income', false);

        // Expenses ledger (expenses view, all items, filter by search)
        renderLedger('ledger-expenses-list', 'expense', false);

        updateFilterPillPosition(currentFilter);

        // Apply swipe animation to recent transactions content
        if (swipeDirection) {
            const historyList = document.getElementById('history-list');
            const mobileHistoryList = document.getElementById('mobile-history-list');
            const animClass = swipeDirection === 'left' ? 'swipe-animate-left' : (swipeDirection === 'right' ? 'swipe-animate-right' : '');

            if (animClass) {
                if (historyList) {
                    historyList.classList.remove('swipe-animate-left', 'swipe-animate-right');
                    void historyList.offsetWidth;
                    historyList.classList.add(animClass);
                }
                if (mobileHistoryList) {
                    mobileHistoryList.classList.remove('swipe-animate-left', 'swipe-animate-right');
                    void mobileHistoryList.offsetWidth;
                    mobileHistoryList.classList.add(animClass);
                }
            }
        }
    };

    const getBezierPath = (points) => {
        if (points.length === 0) return '';
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const cpX1 = p0.x + (p1.x - p0.x) / 2;
            const cpY1 = p0.y;
            const cpX2 = p0.x + (p1.x - p0.x) / 2;
            const cpY2 = p1.y;
            d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
        }
        return d;
    };

    const hideAllChartPopups = () => {
        document.querySelectorAll('.chart-popup-tooltip').forEach(el => {
            el.classList.remove('visible');
        });
        document.querySelectorAll('.chart-guide-line.visible').forEach(el => {
            el.classList.remove('visible');
        });
        document.querySelectorAll('.chart-point.active-point').forEach(el => {
            el.classList.remove('active-point');
        });
        document.querySelectorAll('svg').forEach(s => {
            s._activeDayIdx = -1;
        });
    };

    const showChartPopup = (chartWrapper, svg, x, yTarget, dateStr, income, expense, points, guideLine) => {
        if (!chartWrapper || !svg) return;

        // Hide previous active lines and points across this svg without flickering popup
        svg.querySelectorAll('.chart-guide-line.visible').forEach(el => {
            el.classList.remove('visible');
        });
        svg.querySelectorAll('.chart-point.active-point').forEach(el => {
            el.classList.remove('active-point');
        });

        if (guideLine) guideLine.classList.add('visible');
        if (points && points.length > 0) {
            points.forEach(p => {
                if (p) p.classList.add('active-point');
            });
        }

        let popup = chartWrapper.querySelector('.chart-popup-tooltip');
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'chart-popup-tooltip';
            chartWrapper.appendChild(popup);
        }

        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayNum = dateObj.getDate();
        const monthName = dateObj.toLocaleDateString('pt-PT', { month: 'long' });
        const weekday = dateObj.toLocaleDateString('pt-PT', { weekday: 'short' });
        const formattedDate = `${dayNum} ${monthName}, ${weekday}`;

        popup.innerHTML = `
            <div class="chart-popup-date">${formattedDate}</div>
            <div class="chart-popup-row">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="chart-popup-dot income"></span>
                    <span class="chart-popup-label">Rendimentos</span>
                </div>
                <span class="chart-popup-val income">+${formatCurrency(income)}</span>
            </div>
            <div class="chart-popup-row">
                <div class="flex items-center gap-1.5 min-w-0">
                    <span class="chart-popup-dot expense"></span>
                    <span class="chart-popup-label">Despesas</span>
                </div>
                <span class="chart-popup-val expense">-${formatCurrency(expense)}</span>
            </div>
        `;

        const wrapperRect = chartWrapper.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const vbWidth = (viewBox && viewBox.width > 0) ? viewBox.width : svgRect.width;
        const vbHeight = (viewBox && viewBox.height > 0) ? viewBox.height : svgRect.height;

        const scaleX = vbWidth > 0 ? (svgRect.width / vbWidth) : 1;
        const scaleY = vbHeight > 0 ? (svgRect.height / vbHeight) : 1;
        const pixelX = (x * scaleX) + (svgRect.left - wrapperRect.left);
        const pixelY = (yTarget * scaleY) + (svgRect.top - wrapperRect.top);

        const halfTooltipWidth = 75;
        let tx = '-50%';
        let leftPos = pixelX;

        if (pixelX < halfTooltipWidth + 10) {
            tx = '0%';
            leftPos = Math.max(8, pixelX - 10);
        } else if (pixelX > wrapperRect.width - (halfTooltipWidth + 10)) {
            tx = '-100%';
            leftPos = Math.min(wrapperRect.width - 8, pixelX + 10);
        }

        let ty = '-100%';
        let topPos = pixelY - 14;

        if (pixelY < 85) {
            ty = '0%';
            topPos = pixelY + 16;
        }

        popup.style.setProperty('--popup-tx', tx);
        popup.style.setProperty('--popup-ty', ty);
        popup.style.left = `${Math.round(leftPos)}px`;
        popup.style.top = `${Math.round(topPos)}px`;

        popup.classList.add('visible');
    };

    const createChartPoint = (group, x, y, className, valueStr) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x.toString());
        circle.setAttribute('cy', y.toString());

        const isMobile = window.innerWidth < 640;
        circle.setAttribute('r', isMobile ? '2.5' : '4.5');
        circle.className.baseVal = `chart-point ${className}`;

        // Simple title tooltip for fallback
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = valueStr;
        circle.appendChild(title);

        group.appendChild(circle);
        return circle;
    };

    const renderSingleChart = (svgId, gridLinesId, incomePathId, expensePathId, incomeAreaId, expenseAreaId, pointsGroupId, datesLabelsId, showInteractive) => {
        const svg = document.getElementById(svgId);
        const gridLinesGroup = document.getElementById(gridLinesId);
        const incomePath = document.getElementById(incomePathId);
        const expensePath = document.getElementById(expensePathId);
        const incomeArea = document.getElementById(incomeAreaId);
        const expenseArea = document.getElementById(expenseAreaId);
        const pointsGroup = pointsGroupId ? document.getElementById(pointsGroupId) : null;
        const datesLabels = datesLabelsId ? document.getElementById(datesLabelsId) : null;

        if (!svg || !gridLinesGroup) return;

        const chartWrapper = svg.closest('.chart-wrapper') || svg.parentElement;
        if (chartWrapper) {
            chartWrapper.classList.add('chart-wrapper');
        }

        gridLinesGroup.innerHTML = '';
        if (pointsGroup) {
            pointsGroup.innerHTML = '';
            pointsGroup.style.pointerEvents = 'none';
        }
        if (datesLabels) datesLabels.innerHTML = '';

        // Setup guides group
        let guidesGroup = svg.querySelector('.chart-guides-group');
        if (!guidesGroup) {
            guidesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            guidesGroup.setAttribute('class', 'chart-guides-group');
            if (pointsGroup) {
                svg.insertBefore(guidesGroup, pointsGroup);
            } else {
                svg.appendChild(guidesGroup);
            }
        }
        guidesGroup.innerHTML = '';

        // Setup hit group
        let hitGroup = svg.querySelector('.chart-hit-group');
        if (!hitGroup) {
            hitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            hitGroup.setAttribute('class', 'chart-hit-group');
            svg.appendChild(hitGroup);
        } else {
            // Keep hit group as the topmost layer
            svg.appendChild(hitGroup);
        }
        hitGroup.innerHTML = '';

        // Hide popups when mouse cursor leaves the svg
        svg.onpointerleave = (e) => {
            if (e.pointerType === 'mouse') {
                hideAllChartPopups();
            }
        };

        // Use actual bounding client dimensions to prevent coordinate distortion
        const rect = svg.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : (svgId === 'finance-chart' ? 1000 : 500);
        const height = rect.height > 0 ? rect.height : (svgId === 'finance-chart' ? 300 : 200);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        const paddingX = width * 0.04;
        const paddingY = height * 0.10;
        const chartWidth = width - (paddingX * 2);
        const chartHeight = height - (paddingY * 2);

        // Get all days of the selected calendar month (from 1st to last)
        const dates = [];
        const year = selectedYear;
        const month = selectedMonth;
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();

        for (let d = 1; d <= totalDays; d++) {
            const dateObj = new Date(year, month, d);
            dates.push(getLocalDateString(dateObj));
        }

        // Aggregate income and expenses per day
        const aggregates = {};
        dates.forEach(d => {
            aggregates[d] = { income: 0, expense: 0 };
        });

        transactions.forEach(t => {
            if (aggregates[t.date]) {
                if (t.type === 'income') {
                    aggregates[t.date].income += t.amount;
                } else if (t.type === 'expense') {
                    aggregates[t.date].expense += t.amount;
                }
            }
        });

        // Find max value to scale chart
        let maxVal = 1000;
        dates.forEach(d => {
            if (aggregates[d].income > maxVal) maxVal = aggregates[d].income;
            if (aggregates[d].expense > maxVal) maxVal = aggregates[d].expense;
        });

        maxVal = maxVal * 1.15;

        // Render Grid Lines
        const gridSteps = 4;
        for (let i = 0; i <= gridSteps; i++) {
            const y = paddingY + (chartHeight / gridSteps) * i;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', paddingX.toString());
            line.setAttribute('y1', y.toString());
            line.setAttribute('x2', (width - paddingX).toString());
            line.setAttribute('y2', y.toString());
            gridLinesGroup.appendChild(line);
        }

        // Generate Path strings and points
        let incomePoints = [];
        let expensePoints = [];

        const colWidth = dates.length > 1 ? (chartWidth / (dates.length - 1)) : chartWidth;
        const halfCol = colWidth / 2;

        const dayData = [];

        dates.forEach((d, idx) => {
            const x = paddingX + colWidth * idx;
            const yIncome = (height - paddingY) - (aggregates[d].income / maxVal) * chartHeight;
            const yExpense = (height - paddingY) - (aggregates[d].expense / maxVal) * chartHeight;

            incomePoints.push({ x, y: yIncome });
            expensePoints.push({ x, y: yExpense });

            let dayPoints = [];
            if (showInteractive && pointsGroup) {
                const pInc = createChartPoint(pointsGroup, x, yIncome, 'income-point', `${aggregates[d].income.toFixed(2)} €`);
                const pExp = createChartPoint(pointsGroup, x, yExpense, 'expense-point', `${aggregates[d].expense.toFixed(2)} €`);
                dayPoints.push(pInc, pExp);
            }

            // Guide line for this day
            const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            guideLine.setAttribute('x1', x.toString());
            guideLine.setAttribute('y1', paddingY.toString());
            guideLine.setAttribute('x2', x.toString());
            guideLine.setAttribute('y2', (height - paddingY).toString());
            guideLine.setAttribute('class', 'chart-guide-line');
            guidesGroup.appendChild(guideLine);

            dayData.push({
                idx,
                dateStr: d,
                x,
                yIncome,
                yExpense,
                income: aggregates[d].income,
                expense: aggregates[d].expense,
                dayPoints,
                guideLine
            });

            if (datesLabels) {
                if (idx % 6 === 0 || idx === dates.length - 1) {
                    const dateObj = new Date(d);
                    const labelStr = dateObj.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
                    const span = document.createElement('span');
                    span.className = 'chart-date-label';
                    span.textContent = labelStr;
                    datesLabels.appendChild(span);
                }
            }
        });

        // Interactive touch & pointer scrubbing overlay across the entire chart
        if (showInteractive && hitGroup) {
            svg._activeDayIdx = -1;

            const scrubToClientX = (clientX) => {
                if (dayData.length === 0) return;
                const rect = svg.getBoundingClientRect();
                if (!rect || rect.width <= 0) return;

                const svgX = ((clientX - rect.left) / rect.width) * width;
                const clampedX = Math.max(paddingX, Math.min(paddingX + chartWidth, svgX));
                const dayIdx = Math.max(0, Math.min(dayData.length - 1, Math.round(((clampedX - paddingX) / chartWidth) * (dayData.length - 1))));

                if (dayIdx === svg._activeDayIdx) return;
                svg._activeDayIdx = dayIdx;

                const dInfo = dayData[dayIdx];
                if (dInfo) {
                    const targetY = Math.min(dInfo.yIncome, dInfo.yExpense);
                    showChartPopup(chartWrapper, svg, dInfo.x, targetY, dInfo.dateStr, dInfo.income, dInfo.expense, dInfo.dayPoints, dInfo.guideLine);
                }
            };

            const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            overlay.setAttribute('x', '0');
            overlay.setAttribute('y', '0');
            overlay.setAttribute('width', width.toString());
            overlay.setAttribute('height', height.toString());
            overlay.setAttribute('fill', 'rgba(0, 0, 0, 0.001)');
            overlay.setAttribute('pointer-events', 'all');
            overlay.setAttribute('class', 'chart-scrub-overlay');
            overlay.style.cursor = 'crosshair';
            overlay.style.pointerEvents = 'all';
            overlay.style.touchAction = 'none';

            let isTouching = false;

            // Touch events for mobile scrub / slide
            overlay.addEventListener('touchstart', (e) => {
                if (e.touches && e.touches.length > 0) {
                    isTouching = true;
                    e.stopPropagation();
                    scrubToClientX(e.touches[0].clientX);
                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: false });

            overlay.addEventListener('touchmove', (e) => {
                if (isTouching && e.touches && e.touches.length > 0) {
                    e.stopPropagation();
                    scrubToClientX(e.touches[0].clientX);
                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: false });

            overlay.addEventListener('touchend', (e) => {
                isTouching = false;
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            overlay.addEventListener('touchcancel', () => {
                isTouching = false;
            }, { passive: true });

            // Desktop pointer events for hover & drag
            overlay.addEventListener('pointerenter', (e) => {
                if (e.pointerType === 'mouse') {
                    scrubToClientX(e.clientX);
                }
            });

            overlay.addEventListener('pointermove', (e) => {
                if (e.pointerType === 'mouse' || isTouching) {
                    scrubToClientX(e.clientX);
                }
            });

            overlay.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                scrubToClientX(e.clientX);
            });

            hitGroup.appendChild(overlay);
        }

        const incomeD = getBezierPath(incomePoints);
        const expenseD = getBezierPath(expensePoints);

        if (incomePath) incomePath.setAttribute('d', incomeD);
        if (expensePath) expensePath.setAttribute('d', expenseD);

        const bottomY = height - paddingY;
        if (incomePoints.length > 0 && incomeArea) {
            const firstX = incomePoints[0].x;
            const lastX = incomePoints[incomePoints.length - 1].x;
            incomeArea.setAttribute('d', `${incomeD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`);
        }
        if (expensePoints.length > 0 && expenseArea) {
            const firstX = expensePoints[0].x;
            const lastX = expensePoints[expensePoints.length - 1].x;
            expenseArea.setAttribute('d', `${expenseD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`);
        }
    };

    const renderChart = () => {
        hideAllChartPopups();

        // 1. Render Main Large Chart (in Statistics View)
        renderSingleChart('finance-chart', 'chart-grid-lines', 'chart-income-path', 'chart-expense-path', 'chart-income-area', 'chart-expense-area', 'chart-points-group', 'chart-dates-labels', true);

        // 2. Render Mini Dashboard Chart (in Dashboard View)
        renderSingleChart('dashboard-mini-chart', 'db-chart-grid-lines', 'db-chart-income-path', 'db-chart-expense-path', 'db-chart-income-area', 'db-chart-expense-area', 'db-chart-points-group', 'db-chart-dates-labels', true);
    };

    const categorizeWithAI = async (description, type) => {
        if (!description) return getCategoryName(description, type);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const resp = await fetch(getApiUrl('api/categorize'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                signal: controller.signal,
                body: JSON.stringify({ description, type })
            });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.success && data.category) {
                    const localCat = getCategoryName(description, type);
                    // Prevent AI from downgrading a recognized category to 'Інші витрати'/'Інші доходи'
                    if ((data.category === 'Outras despesas' || data.category === 'Outros rendimentos') &&
                        (localCat !== 'Outras despesas' && localCat !== 'Outros rendimentos')) {
                        return localCat;
                    }
                    return data.category;
                }
            }
        } catch (err) {
            // Instant fast fallback to local rule categorization
        }
        return getCategoryName(description, type);
    };

    const EXPENSE_CATEGORY_ITEMS = [
        {
            id: 'auto',
            name: 'Automático (IA e histórico)',
            shortName: 'Automático',
            icon: 'auto_awesome',
            color: '#A855F7',
            bg: 'bg-purple-500/15',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            desc: 'Determinação automática pela descrição da transação e o seu histórico',
            keywords: 'авто авто-визначення ai штучний інтелект історія подібні'
        },
        {
            id: 'Alimentação',
            name: 'Alimentação',
            shortName: 'Alimentação',
            icon: 'shopping_cart',
            color: '#10B981',
            bg: 'bg-emerald-500/15',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            desc: 'Supermercados, pão, lacticínios, carne, legumes, frutas',
            keywords: 'продукти харчування їжа супермаркет сільпо атб хліб булочка булочки круасан бакалія м\'ясо сир'
        },
        {
            id: 'Cafés e restaurantes',
            name: 'Cafés e restaurantes',
            shortName: 'Cafés',
            icon: 'restaurant',
            color: '#F59E0B',
            bg: 'bg-amber-500/15',
            border: 'border-amber-500/30',
            text: 'text-amber-400',
            desc: 'Cafetarias, bares, pizzarias, take-away, fast-food, almoços',
            keywords: 'кафе ресторан кава чай макдональдс піца суші доставка обід ланч burger kfc'
        },
        {
            id: 'Transporte e automóvel',
            name: 'Transporte e automóvel',
            shortName: 'Transporte',
            icon: 'directions_car',
            color: '#3B82F6',
            bg: 'bg-blue-500/15',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            desc: 'Combustível, posto, táxi, metro, bilhetes, estacionamento, lavagem, oficina',
            keywords: 'транспорт авто автомобіль пальне бензин газ азс wog okko таксі uber уклон метро поїзд квиток'
        },
        {
            id: 'Habitação e utilidades',
            name: 'Habitação e utilidades',
            shortName: 'Habitação',
            icon: 'home',
            color: '#20a034',
            bg: 'bg-indigo-500/15',
            border: 'border-indigo-500/30',
            text: 'text-indigo-400',
            desc: 'Renda, condomínio, eletricidade, gás, internet, comunicações, reparações',
            keywords: 'комунальні житло оренда квартира світло газ вода інтернет телефон зв\'язок kyivstar lifecell'
        },
        {
            id: 'Saúde e desporto',
            name: 'Saúde e desporto',
            shortName: 'Saúde',
            icon: 'fitness_center',
            color: '#EC4899',
            bg: 'bg-pink-500/15',
            border: 'border-pink-500/30',
            text: 'text-pink-400',
            desc: 'Farmácias, medicamentos, vitaminas, médicos, análises, dentista, ginásio',
            keywords: 'здоров\'я спорт аптека ліки вітаміни лікар клініка стоматолог зал фітнес тренування'
        },
        {
            id: 'Compras e vestuário',
            name: 'Compras e vestuário',
            shortName: 'Compras',
            icon: 'shopping_bag',
            color: '#06B6D4',
            bg: 'bg-cyan-500/15',
            border: 'border-cyan-500/30',
            text: 'text-cyan-400',
            desc: 'Vestuário, calçado, tecnologia, eletrónica, artigos para casa, marketplace',
            keywords: 'покупки одяг взуття техніка телефон ноут розетка rozetka prom zara кросівки шопінг'
        },
        {
            id: 'Lazer e entretenimento',
            name: 'Lazer e entretenimento',
            shortName: 'Lazer',
            icon: 'movie',
            color: '#F97316',
            bg: 'bg-orange-500/15',
            border: 'border-orange-500/30',
            text: 'text-orange-400',
            desc: 'Cinema, subscrições (Netflix, Spotify, YouTube), jogos, hobbies, lazer',
            keywords: 'розваги дозвілля кіно фільм підписка netflix spotify youtube steam гра квитки театр відпочинок'
        },
        {
            id: 'Outras despesas',
            name: 'Outras despesas',
            shortName: 'Outras',
            icon: 'receipt_long',
            color: '#64748B',
            bg: 'bg-slate-500/15',
            border: 'border-slate-500/30',
            text: 'text-slate-400',
            desc: 'Diversas outras despesas diárias, comissões bancárias, donativos',
            keywords: 'інші різні комісія податки переказ благодійність донат готівка'
        }
    ];

    const updateExpenseCategoryPreview = () => {
        const descInput = document.getElementById('expense-description');
        const select = document.getElementById('expense-category-select');
        const triggerTitle = document.getElementById('expense-category-trigger-title');
        const triggerSub = document.getElementById('expense-category-trigger-sub');
        const triggerIcon = document.getElementById('expense-category-trigger-icon');

        const desc = descInput ? descInput.value.trim() : '';
        const selectedVal = select ? (select.value || 'auto') : 'auto';

        if (selectedVal !== 'auto') {
            const catIcon = getCategoryIcon(selectedVal, 'expense');
            if (triggerTitle) triggerTitle.textContent = selectedVal;
            if (triggerSub) triggerSub.textContent = 'Selecionado manualmente (clique para alterar)';
            if (triggerIcon) triggerIcon.textContent = catIcon;
            return;
        }

        if (!desc) {
            if (triggerTitle) triggerTitle.textContent = 'Automático (IA)';
            if (triggerSub) triggerSub.textContent = 'Auto-determinação pela descrição (clique para alterar)';
            if (triggerIcon) triggerIcon.textContent = 'auto_awesome';
            return;
        }

        const predictedCat = getCategoryName(desc, 'expense');
        const predictedIcon = getCategoryIcon(predictedCat, 'expense');
        if (triggerTitle) triggerTitle.textContent = `Auto: ${predictedCat}`;
        if (triggerSub) triggerSub.textContent = 'Determinado automaticamente (clique para alterar)';
        if (triggerIcon) triggerIcon.textContent = predictedIcon;
    };

    function renderExpenseCategoryModalOptions() {
        const listEl = document.getElementById('expense-category-modal-list');
        const selectEl = document.getElementById('expense-category-select');
        if (!listEl) return;

        const currentVal = selectEl ? (selectEl.value || 'auto') : 'auto';

        listEl.innerHTML = '';
        EXPENSE_CATEGORY_ITEMS.forEach(item => {
            const isSelected = (item.id === currentVal);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `expense-cat-card w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer ${isSelected ? 'active-cat' : 'border-[#202024] bg-[#161619]/40 hover:border-[#2b2b30]'
                }`;

            btn.innerHTML = `
                <div class="flex items-center gap-3 min-w-0 pr-2">
                    <div class="w-9 h-9 rounded-xl ${item.bg} ${item.border} border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                        <span class="material-symbols-outlined text-[20px]" style="color: ${item.color};">${item.icon}</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white group-hover:text-brand-purple transition-colors truncate">
                            <span>${item.name}</span>
                        </div>
                        <div class="text-[10px] text-brand-textSecondary truncate mt-0.5">${item.desc}</div>
                    </div>
                </div>
                <div class="flex-shrink-0 flex items-center justify-center w-6 h-6">
                    <span class="material-symbols-outlined text-[20px] transition-all ${isSelected ? 'text-brand-purple' : 'text-brand-textSecondary/40 group-hover:text-brand-textSecondary'
                }">${isSelected ? 'check_circle' : 'radio_button_unchecked'}</span>
                </div>
            `;

            btn.addEventListener('click', () => {
                selectExpenseCategory(item.id);
            });

            listEl.appendChild(btn);
        });
    }

    function openExpenseCategoryModal() {
        const modal = document.getElementById('expense-category-modal');
        if (!modal) return;
        renderExpenseCategoryModalOptions();
        modal.classList.add('active');
    }

    function closeExpenseCategoryModal() {
        const modal = document.getElementById('expense-category-modal');
        if (modal) modal.classList.remove('active');
    }

    function selectExpenseCategory(catId) {
        const select = document.getElementById('expense-category-select');
        if (select) {
            select.value = catId;
        }
        updateExpenseCategoryPreview();
        closeExpenseCategoryModal();
    }

    function initExpenseCategoryModal() {
        const triggerBtn = document.getElementById('expense-category-trigger-btn');
        const closeBtn = document.getElementById('close-expense-category-modal-btn');
        const modal = document.getElementById('expense-category-modal');

        if (triggerBtn) triggerBtn.addEventListener('click', openExpenseCategoryModal);
        if (closeBtn) closeBtn.addEventListener('click', closeExpenseCategoryModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeExpenseCategoryModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                closeExpenseCategoryModal();
            }
        });
    }

    const INCOME_CATEGORY_ITEMS = [
        {
            id: 'auto',
            name: 'Automático (IA e histórico)',
            shortName: 'Automático',
            icon: 'auto_awesome',
            color: '#20a034',
            bg: 'bg-[#20a034]/15',
            border: 'border-[#20a034]/30',
            text: 'text-[#20a034]',
            desc: 'Determinação automática pela descrição da transação e o seu histórico'
        },
        {
            id: 'Salário',
            name: 'Salário',
            shortName: 'Salário',
            icon: 'work',
            color: '#10B981',
            bg: 'bg-emerald-500/15',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            desc: 'Salário base, adiantamento, remuneração, prestações mensais'
        },
        {
            id: 'Freelance e projetos',
            name: 'Freelance e projetos',
            shortName: 'Freelance',
            icon: 'computer',
            color: '#3B82F6',
            bg: 'bg-blue-500/15',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            desc: 'Contratos, trabalho por projetos, outsourcing, honorários, biscates'
        },
        {
            id: 'Prémios e gorjetas',
            name: 'Prémios e gorjetas',
            shortName: 'Prémios',
            icon: 'redeem',
            color: '#F59E0B',
            bg: 'bg-amber-500/15',
            border: 'border-amber-500/30',
            text: 'text-amber-400',
            desc: 'Prémios, presentes em dinheiro, recompensas, gorjetas, bonificações'
        },
        {
            id: 'Investimentos e cashback',
            name: 'Investimentos e cashback',
            shortName: 'Investimentos',
            icon: 'trending_up',
            color: '#20a034',
            bg: 'bg-purple-500/15',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            desc: 'Dividendos, juros de depósitos, cashback bancário, rendimento passivo'
        },
        {
            id: 'Outros rendimentos',
            name: 'Outros rendimentos',
            shortName: 'Outras',
            icon: 'payments',
            color: '#64748B',
            bg: 'bg-slate-500/15',
            border: 'border-slate-500/30',
            text: 'text-slate-400',
            desc: 'Devoluções, compensações, venda de artigos e outros rendimentos'
        }
    ];

    const updateIncomeCategoryPreview = () => {
        const descInput = document.getElementById('income-description');
        const select = document.getElementById('income-category-select');
        const triggerTitle = document.getElementById('income-category-trigger-title');
        const triggerSub = document.getElementById('income-category-trigger-sub');
        const triggerIcon = document.getElementById('income-category-trigger-icon');

        const desc = descInput ? descInput.value.trim() : '';
        const selectedVal = select ? (select.value || 'auto') : 'auto';

        if (selectedVal !== 'auto') {
            const catIcon = getCategoryIcon(selectedVal, 'income');
            if (triggerTitle) triggerTitle.textContent = selectedVal;
            if (triggerSub) triggerSub.textContent = 'Selecionado manualmente (clique para alterar)';
            if (triggerIcon) triggerIcon.textContent = catIcon;
            return;
        }

        if (!desc) {
            if (triggerTitle) triggerTitle.textContent = 'Automático (IA)';
            if (triggerSub) triggerSub.textContent = 'Auto-determinação pela descrição (clique para alterar)';
            if (triggerIcon) triggerIcon.textContent = 'auto_awesome';
            return;
        }

        const predictedCat = getCategoryName(desc, 'income');
        const predictedIcon = getCategoryIcon(predictedCat, 'income');
        if (triggerTitle) triggerTitle.textContent = `Auto: ${predictedCat}`;
        if (triggerSub) triggerSub.textContent = 'Determinado automaticamente (clique para alterar)';
        if (triggerIcon) triggerIcon.textContent = predictedIcon;
    };

    function renderIncomeCategoryModalOptions() {
        const listEl = document.getElementById('income-category-modal-list');
        const selectEl = document.getElementById('income-category-select');
        if (!listEl) return;

        const currentVal = selectEl ? (selectEl.value || 'auto') : 'auto';

        listEl.innerHTML = '';
        INCOME_CATEGORY_ITEMS.forEach(item => {
            const isSelected = (item.id === currentVal);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `income-cat-card w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer ${isSelected ? 'active-cat' : 'border-[#202024] bg-[#161619]/40 hover:border-[#2b2b30]'
                }`;

            btn.innerHTML = `
                <div class="flex items-center gap-3 min-w-0 pr-2">
                    <div class="w-9 h-9 rounded-xl ${item.bg} ${item.border} border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                        <span class="material-symbols-outlined text-[20px]" style="color: ${item.color};">${item.icon}</span>
                    </div>
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white group-hover:text-brand-accent transition-colors truncate">
                            <span>${item.name}</span>
                        </div>
                        <div class="text-[10px] text-brand-textSecondary truncate mt-0.5">${item.desc}</div>
                    </div>
                </div>
                <div class="flex-shrink-0 flex items-center justify-center w-6 h-6">
                    <span class="material-symbols-outlined text-[20px] transition-all ${isSelected ? 'text-brand-accent' : 'text-brand-textSecondary/40 group-hover:text-brand-textSecondary'
                }">${isSelected ? 'check_circle' : 'radio_button_unchecked'}</span>
                </div>
            `;

            btn.addEventListener('click', () => {
                selectIncomeCategory(item.id);
            });

            listEl.appendChild(btn);
        });
    }

    function openIncomeCategoryModal() {
        const modal = document.getElementById('income-category-modal');
        if (!modal) return;
        renderIncomeCategoryModalOptions();
        modal.classList.add('active');
    }

    function closeIncomeCategoryModal() {
        const modal = document.getElementById('income-category-modal');
        if (modal) modal.classList.remove('active');
    }

    function selectIncomeCategory(catId) {
        const select = document.getElementById('income-category-select');
        if (select) {
            select.value = catId;
        }
        updateIncomeCategoryPreview();
        closeIncomeCategoryModal();
    }

    function initIncomeCategoryModal() {
        const triggerBtn = document.getElementById('income-category-trigger-btn');
        const closeBtn = document.getElementById('close-income-category-modal-btn');
        const modal = document.getElementById('income-category-modal');

        if (triggerBtn) triggerBtn.addEventListener('click', openIncomeCategoryModal);
        if (closeBtn) closeBtn.addEventListener('click', closeIncomeCategoryModal);

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeIncomeCategoryModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                closeIncomeCategoryModal();
            }
        });
    }

    // Historical Amount-Based Auto-Suggestions
    const DEFAULT_EXPENSE_PLACEHOLDER = 'Ex: Supermercado, Renda, Café...';
    const DEFAULT_INCOME_PLACEHOLDER = 'Ex: Salário, Freelance...';

    const getTimesWord = (count) => { return count === 1 ? 'vez' : 'vezes'; };

    const getAmountSuggestions = (amount, type) => {
        if (!amount && amount !== 0) return [];
        const num = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : parseFloat(amount);
        if (isNaN(num) || num <= 0 || !Array.isArray(transactions)) return [];

        const targetKopecks = Math.round(num * 100);
        const map = new Map();

        transactions.forEach(t => {
            if (!t || t.type !== type) return;
            const tAmount = parseFloat(t.amount);
            if (isNaN(tAmount)) return;
            if (Math.round(tAmount * 100) !== targetKopecks) return;

            const rawDesc = (t.description || '').trim();
            if (!rawDesc) return;

            const key = rawDesc.toLowerCase();
            const txDate = t.date || '';

            if (map.has(key)) {
                const item = map.get(key);
                item.count += 1;
                if (txDate && (!item.latestDate || txDate > item.latestDate)) {
                    item.latestDate = txDate;
                    item.displayDesc = rawDesc;
                }
            } else {
                map.set(key, {
                    key,
                    displayDesc: rawDesc,
                    count: 1,
                    latestDate: txDate
                });
            }
        });

        // Strict threshold: only propose if count >= 2
        return Array.from(map.values())
            .filter(item => item.count >= 2)
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return (b.latestDate || '').localeCompare(a.latestDate || '');
            });
    };

    const updateExpenseAmountSuggestions = () => {
        const amountInput = document.getElementById('expense-amount');
        const descInput = document.getElementById('expense-description');
        const container = document.getElementById('expense-amount-suggestions');
        if (!container) return;

        const amountVal = amountInput ? amountInput.value.trim() : '';
        const suggestions = amountVal ? getAmountSuggestions(amountVal, 'expense') : [];

        if (suggestions.length === 0) {
            container.innerHTML = '';
            delete container.dataset.renderedAmount;
            container.classList.add('hidden');
            if (descInput && descInput.dataset.hasAmountPlaceholder === 'true') {
                descInput.placeholder = DEFAULT_EXPENSE_PLACEHOLDER;
                delete descInput.dataset.hasAmountPlaceholder;
            }
            return;
        }

        if (descInput) {
            if (!descInput.value.trim()) {
                descInput.placeholder = `Sugestão: ${suggestions[0].displayDesc}`;
                descInput.dataset.hasAmountPlaceholder = 'true';
            } else if (descInput.dataset.hasAmountPlaceholder === 'true') {
                descInput.placeholder = DEFAULT_EXPENSE_PLACEHOLDER;
                delete descInput.dataset.hasAmountPlaceholder;
            }
        }

        const currentDesc = descInput ? descInput.value.trim().toLowerCase() : '';

        // If suggestions for this amount are already in DOM, only update active chip styling to prevent dropped clicks
        if (container.dataset.renderedAmount === amountVal && !container.classList.contains('hidden')) {
            const chips = container.querySelectorAll('.amount-suggest-chip');
            chips.forEach(c => {
                if (c.dataset.key === currentDesc) {
                    c.classList.add('active-chip');
                } else {
                    c.classList.remove('active-chip');
                }
            });
            return;
        }

        container.dataset.renderedAmount = amountVal;
        container.innerHTML = '';

        // Header row
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-0.5 text-[11px] text-brand-textSecondary font-medium select-none';
        header.innerHTML = `
            <span class="flex items-center gap-1.5 text-brand-purple">
                <span class="material-symbols-outlined text-[14px]">history</span>
                <span>Sugestões para este valor:</span>
            </span>
            <span class="text-[10px] text-brand-textSecondary/60 hidden sm:inline">deslize para selecionar</span>
        `;
        container.appendChild(header);

        // Horizontal scroll track
        const scrollTrack = document.createElement('div');
        scrollTrack.className = 'amount-suggest-scroll w-full';

        suggestions.slice(0, 8).forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.key = s.key;
            const isActive = currentDesc === s.key;
            btn.className = `amount-suggest-chip expense-chip ${isActive ? 'active-chip' : ''}`;
            btn.title = `Preencher «${s.displayDesc}» (utilizado ${s.count} ${getTimesWord(s.count)})`;
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[15px] opacity-70 pointer-events-none">arrow_forward</span>
                <span class="max-w-[180px] truncate pointer-events-none">${escapeHtml(s.displayDesc)}</span>
                <span class="amount-suggest-badge pointer-events-none">${s.count} ${getTimesWord(s.count)}</span>
            `;

            // Prevent input blur before click is dispatched
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (descInput) {
                    descInput.value = s.displayDesc;
                    delete descInput.dataset.hasAmountPlaceholder;
                    updateExpenseCategoryPreview();
                    updateExpenseAmountSuggestions();
                    descInput.focus();
                }
            });
            scrollTrack.appendChild(btn);
        });

        container.appendChild(scrollTrack);
        container.classList.remove('hidden');
    };

    const updateIncomeAmountSuggestions = () => {
        const amountInput = document.getElementById('income-amount');
        const descInput = document.getElementById('income-description');
        const container = document.getElementById('income-amount-suggestions');
        if (!container) return;

        const amountVal = amountInput ? amountInput.value.trim() : '';
        const suggestions = amountVal ? getAmountSuggestions(amountVal, 'income') : [];

        if (suggestions.length === 0) {
            container.innerHTML = '';
            delete container.dataset.renderedAmount;
            container.classList.add('hidden');
            if (descInput && descInput.dataset.hasAmountPlaceholder === 'true') {
                descInput.placeholder = DEFAULT_INCOME_PLACEHOLDER;
                delete descInput.dataset.hasAmountPlaceholder;
            }
            return;
        }

        if (descInput) {
            if (!descInput.value.trim()) {
                descInput.placeholder = `Sugestão: ${suggestions[0].displayDesc}`;
                descInput.dataset.hasAmountPlaceholder = 'true';
            } else if (descInput.dataset.hasAmountPlaceholder === 'true') {
                descInput.placeholder = DEFAULT_INCOME_PLACEHOLDER;
                delete descInput.dataset.hasAmountPlaceholder;
            }
        }

        const currentDesc = descInput ? descInput.value.trim().toLowerCase() : '';

        // If suggestions for this amount are already in DOM, only update active chip styling to prevent dropped clicks
        if (container.dataset.renderedAmount === amountVal && !container.classList.contains('hidden')) {
            const chips = container.querySelectorAll('.amount-suggest-chip');
            chips.forEach(c => {
                if (c.dataset.key === currentDesc) {
                    c.classList.add('active-chip');
                } else {
                    c.classList.remove('active-chip');
                }
            });
            return;
        }

        container.dataset.renderedAmount = amountVal;
        container.innerHTML = '';

        // Header row
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-0.5 text-[11px] text-brand-textSecondary font-medium select-none';
        header.innerHTML = `
            <span class="flex items-center gap-1.5 text-brand-accent">
                <span class="material-symbols-outlined text-[14px]">history</span>
                <span>Sugestões para este valor:</span>
            </span>
            <span class="text-[10px] text-brand-textSecondary/60 hidden sm:inline">deslize para selecionar</span>
        `;
        container.appendChild(header);

        // Horizontal scroll track
        const scrollTrack = document.createElement('div');
        scrollTrack.className = 'amount-suggest-scroll w-full';

        suggestions.slice(0, 8).forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.key = s.key;
            const isActive = currentDesc === s.key;
            btn.className = `amount-suggest-chip income-chip ${isActive ? 'active-chip' : ''}`;
            btn.title = `Preencher «${s.displayDesc}» (utilizado ${s.count} ${getTimesWord(s.count)})`;
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[15px] opacity-70 pointer-events-none">arrow_forward</span>
                <span class="max-w-[180px] truncate pointer-events-none">${escapeHtml(s.displayDesc)}</span>
                <span class="amount-suggest-badge pointer-events-none">${s.count} ${getTimesWord(s.count)}</span>
            `;

            // Prevent input blur before click is dispatched
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (descInput) {
                    descInput.value = s.displayDesc;
                    delete descInput.dataset.hasAmountPlaceholder;
                    updateIncomeCategoryPreview();
                    updateIncomeAmountSuggestions();
                    descInput.focus();
                }
            });
            scrollTrack.appendChild(btn);
        });

        container.appendChild(scrollTrack);
        container.classList.remove('hidden');
    };

    // 3. Form and Event Handlers
    const addTransaction = async (amount, type, description, date, explicitCategory = null, receiptUrl = null) => {
        if (!amount || isNaN(amount) || amount <= 0) return false;
        if (!description) return false;
        if (!date) return false;

        let category = explicitCategory && explicitCategory !== 'auto'
            ? explicitCategory
            : await categorizeWithAI(description, type);

        const newTx = {
            id: Date.now().toString(),
            amount,
            type,
            description,
            category,
            date,
            receipt_url: receiptUrl || null
        };

        transactions.unshift(newTx);
        syncData();
        renderAll();
        showToast(`Transação adicionada (${category})`, 'success');
        return true;
    };

    const handleSavingsSubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('savings-amount').value);
        const description = document.getElementById('savings-description').value.trim();
        const date = document.getElementById('savings-date').value;

        if (await addTransaction(amount, 'savings', description, date)) {
            formAddSavings.reset();
            const todayStr = getLocalDateString(new Date());
            document.getElementById('savings-date').value = todayStr;
        }
    };

    async function uploadReceipt(inputId) {
        const input = document.getElementById(inputId);
        if (!input || !input.files || !input.files[0]) return null;
        const file = input.files[0];
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const res = await fetch(getApiUrl('api/upload-receipt'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ file: base64, name: file.name })
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            if (!data.url) throw new Error('Missing receipt URL');
            return data.url;
        } catch (e) {
            console.warn('Receipt upload failed', e);
            showToast('Não foi possível enviar o recibo. Tente novamente antes de guardar.', 'error');
            return false;
        }
    }

    const handleIncomeSubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('income-amount').value);
        const description = document.getElementById('income-description').value.trim();
        const date = document.getElementById('income-date').value;
        const categorySelect = document.getElementById('income-category-select');
        const explicitCategory = categorySelect && categorySelect.value !== 'auto' ? categorySelect.value : null;
        const receiptUrl = await uploadReceipt('income-receipt');
        if (receiptUrl === false) return;

        if (await addTransaction(amount, 'income', description, date, explicitCategory, receiptUrl)) {
            formAddIncome.reset();
            const todayStr = getLocalDateString(new Date());
            document.getElementById('income-date').value = todayStr;
            const incCat = document.getElementById('income-category-select');
            if (incCat) incCat.value = 'auto';
            updateIncomeCategoryPreview();
            updateIncomeAmountSuggestions();
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const description = document.getElementById('expense-description').value.trim();
        const date = document.getElementById('expense-date').value;
        const categorySelect = document.getElementById('expense-category-select');
        const explicitCategory = categorySelect && categorySelect.value !== 'auto' ? categorySelect.value : null;
        const receiptUrl = await uploadReceipt('expense-receipt');
        if (receiptUrl === false) return;

        if (await addTransaction(amount, 'expense', description, date, explicitCategory, receiptUrl)) {
            formAddExpense.reset();
            const todayStr = getLocalDateString(new Date());
            document.getElementById('expense-date').value = todayStr;
            const expCat = document.getElementById('expense-category-select');
            if (expCat) expCat.value = 'auto';
            updateExpenseCategoryPreview();
            updateExpenseAmountSuggestions();
        }
    };

    let isDeletingTx = false;
    const handleDeleteTransaction = async (id) => {
        if (isDeletingTx) return;
        isDeletingTx = true;
        try {
            const tx = transactions.find(t => String(t.id) === String(id));
            const desc = tx ? `«${tx.description}»` : 'esta transação';

            const confirmed = await showConfirm(
                'Eliminar transação',
                `Tem a certeza de que pretende eliminar ${desc}?`,
                'Eliminar',
                'Cancelar'
            );

            if (confirmed) {
                transactions = transactions.filter(t => String(t.id) !== String(id));
                syncData();
                renderAll();
                showToast('Transação eliminada', 'delete');
            }
        } finally {
            isDeletingTx = false;
        }
    };

    const handleSaveGoal = (e) => {
        e.preventDefault();
        const target = parseFloat(targetAmountInput.value);
        if (target && !isNaN(target) && target > 0) {
            savingsTarget = target;
            syncData();
            renderMetrics();
            closeGoalModal();
            showToast('Objetivo de poupança atualizado', 'success');
        }
    };

    // Modal Helpers
    const openGoalModal = () => {
        targetAmountInput.value = savingsTarget;
        goalModal.classList.add('active');
        targetAmountInput.focus();
    };

    const closeGoalModal = () => {
        goalModal.classList.remove('active');
    };

    // Daily / Weekly / Monthly Limit Modal & Carousel Helpers
    let selectedLimitPeriod = 'day';
    const dailyLimitModal = document.getElementById('daily-limit-modal');
    const closeDailyLimitModalBtn = document.getElementById('close-daily-limit-modal-btn');
    const dailyLimitCancelBtn = document.getElementById('daily-limit-cancel-btn');
    const dailyLimitForm = document.getElementById('daily-limit-form');
    const dailyLimitInput = document.getElementById('daily-limit-input');
    const limitPeriodDayBtn = document.getElementById('limit-period-day-btn');
    const limitPeriodWeekBtn = document.getElementById('limit-period-week-btn');
    const limitPeriodMonthBtn = document.getElementById('limit-period-month-btn');
    const limitModalHeaderTitle = document.getElementById('limit-modal-header-title');
    const limitModalHeaderSubtitle = document.getElementById('limit-modal-header-subtitle');
    const dailyLimitInputLabel = document.getElementById('daily-limit-input-label');

    const limitViewport = document.getElementById('limit-card-viewport');
    let touchStartX = 0;
    let touchStartY = 0;

    if (limitViewport) {
        limitViewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        limitViewport.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const diffX = touchStartX - e.changedTouches[0].clientX;
                const diffY = touchStartY - e.changedTouches[0].clientY;

                if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                    const periods = ['day', 'week', 'month'];
                    let currentIdx = periods.indexOf(expenseLimitPeriod);
                    if (currentIdx === -1) currentIdx = 0;

                    if (diffX > 0 && currentIdx < periods.length - 1) {
                        // Swipe left -> Next slide
                        setLimitCarouselPeriod(periods[currentIdx + 1], true);
                    } else if (diffX < 0 && currentIdx > 0) {
                        // Swipe right -> Previous slide
                        setLimitCarouselPeriod(periods[currentIdx - 1], true);
                    }
                }
            }
        }, { passive: true });
    }

    const limitDotDay = document.getElementById('limit-dot-day');
    const limitDotWeek = document.getElementById('limit-dot-week');
    const limitDotMonth = document.getElementById('limit-dot-month');

    if (limitDotDay) limitDotDay.addEventListener('click', () => setLimitCarouselPeriod('day', true));
    if (limitDotWeek) limitDotWeek.addEventListener('click', () => setLimitCarouselPeriod('week', true));
    if (limitDotMonth) limitDotMonth.addEventListener('click', () => setLimitCarouselPeriod('month', true));

    // Month Picker Modal & Navigation click handlers
    const monthPickerModal = document.getElementById('month-picker-modal');
    const closeMonthPickerBtn = document.getElementById('close-month-picker-btn');
    const pickerPrevYearBtn = document.getElementById('picker-prev-year-btn');
    const pickerNextYearBtn = document.getElementById('picker-next-year-btn');
    const pickerYearLabel = document.getElementById('picker-year-label');
    const monthPickerGrid = document.getElementById('month-picker-grid');

    const openMonthPickerModal = () => {
        pickerYear = selectedYear;
        renderMonthPickerGrid();
        if (monthPickerModal) monthPickerModal.classList.add('active');
    };

    const closeMonthPickerModal = () => {
        if (monthPickerModal) monthPickerModal.classList.remove('active');
    };

    const renderMonthPickerGrid = () => {
        if (!pickerYearLabel || !monthPickerGrid) return;
        pickerYearLabel.textContent = pickerYear;

        const realNow = new Date();
        const realYear = realNow.getFullYear();
        const realMonth = realNow.getMonth();

        if (pickerNextYearBtn) {
            pickerNextYearBtn.disabled = (pickerYear >= realYear);
        }

        monthPickerGrid.innerHTML = '';
        UK_MONTH_SHORT.forEach((mName, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';

            const isFuture = (pickerYear > realYear) || (pickerYear === realYear && idx > realMonth);
            const isSelected = (pickerYear === selectedYear && idx === selectedMonth);

            let baseClass = 'py-2 rounded-xl text-xs font-semibold transition-all ';
            if (isSelected) {
                baseClass += 'bg-brand-purple text-white shadow-md';
            } else if (isFuture) {
                baseClass += 'bg-[#161619] border border-[#202024] text-brand-textSecondary opacity-30 cursor-not-allowed';
            } else {
                baseClass += 'bg-[#161619] border border-[#202024] text-white hover:border-brand-purple hover:bg-brand-purple/20';
            }

            btn.className = baseClass;
            btn.textContent = mName;
            btn.disabled = isFuture;

            if (!isFuture) {
                btn.addEventListener('click', () => {
                    selectedYear = pickerYear;
                    selectedMonth = idx;
                    updateMonthSelectorUI();
                    renderAll();
                    closeMonthPickerModal();
                });
            }

            monthPickerGrid.appendChild(btn);
        });
    };

    if (closeMonthPickerBtn) closeMonthPickerBtn.addEventListener('click', closeMonthPickerModal);
    if (monthPickerModal) {
        monthPickerModal.addEventListener('click', (e) => {
            if (e.target === monthPickerModal) closeMonthPickerModal();
        });
    }
    if (pickerPrevYearBtn) {
        pickerPrevYearBtn.addEventListener('click', () => {
            pickerYear--;
            renderMonthPickerGrid();
        });
    }
    if (pickerNextYearBtn) {
        pickerNextYearBtn.addEventListener('click', () => {
            const realYear = new Date().getFullYear();
            if (pickerYear < realYear) {
                pickerYear++;
                renderMonthPickerGrid();
            }
        });
    }

    // Delegate edit click inside slides & month navigation
    document.addEventListener('click', (e) => {
        const prevBtn = e.target.closest('.btn-prev-month');
        if (prevBtn) {
            changeSelectedMonth(-1);
            return;
        }

        const nextBtn = e.target.closest('.btn-next-month');
        if (nextBtn) {
            changeSelectedMonth(1);
            return;
        }

        const resetBtn = e.target.closest('.btn-reset-month');
        if (resetBtn) {
            resetToCurrentMonth();
            return;
        }

        const openPickerBtn = e.target.closest('.open-month-picker-btn');
        if (openPickerBtn) {
            openMonthPickerModal();
            return;
        }

        const btn = e.target.closest('.btn-edit-limit-slide');
        if (btn) {
            const period = btn.getAttribute('data-period') || 'day';
            setModalPeriodUI(period);
            if (dailyLimitModal) dailyLimitModal.classList.add('active');
            if (dailyLimitInput) dailyLimitInput.focus();
        }
    });

    const setModalPeriodUI = (period) => {
        selectedLimitPeriod = period;
        const activeBtnClass = 'py-2 text-xs font-semibold rounded-lg transition-all bg-brand-purple text-white shadow-md';
        const inactiveBtnClass = 'py-2 text-xs font-semibold rounded-lg transition-all text-brand-textSecondary hover:text-white';

        if (limitPeriodDayBtn) limitPeriodDayBtn.className = period === 'day' ? activeBtnClass : inactiveBtnClass;
        if (limitPeriodWeekBtn) limitPeriodWeekBtn.className = period === 'week' ? activeBtnClass : inactiveBtnClass;
        if (limitPeriodMonthBtn) limitPeriodMonthBtn.className = period === 'month' ? activeBtnClass : inactiveBtnClass;

        if (period === 'month') {
            if (limitModalHeaderTitle) limitModalHeaderTitle.textContent = 'Limite mensal de despesas';
            if (limitModalHeaderSubtitle) limitModalHeaderSubtitle.textContent = 'Valor máximo de despesas por mês';
            if (dailyLimitInputLabel) dailyLimitInputLabel.textContent = 'Valor do limite mensal (€)';
            if (dailyLimitInput) dailyLimitInput.value = monthlyExpenseLimit;
        } else if (period === 'week') {
            if (limitModalHeaderTitle) limitModalHeaderTitle.textContent = 'Limite semanal de despesas';
            if (limitModalHeaderSubtitle) limitModalHeaderSubtitle.textContent = 'Valor máximo de despesas por semana';
            if (dailyLimitInputLabel) dailyLimitInputLabel.textContent = 'Valor do limite semanal (€)';
            if (dailyLimitInput) dailyLimitInput.value = weeklyExpenseLimit;
        } else {
            if (limitModalHeaderTitle) limitModalHeaderTitle.textContent = 'Limite diário de despesas';
            if (limitModalHeaderSubtitle) limitModalHeaderSubtitle.textContent = 'Valor máximo de despesas por dia';
            if (dailyLimitInputLabel) dailyLimitInputLabel.textContent = 'Valor do limite diário (€)';
            if (dailyLimitInput) dailyLimitInput.value = dailyExpenseLimit;
        }
    };

    if (limitPeriodDayBtn) limitPeriodDayBtn.addEventListener('click', () => setModalPeriodUI('day'));
    if (limitPeriodWeekBtn) limitPeriodWeekBtn.addEventListener('click', () => setModalPeriodUI('week'));
    if (limitPeriodMonthBtn) limitPeriodMonthBtn.addEventListener('click', () => setModalPeriodUI('month'));

    const openDailyLimitModal = () => {
        setModalPeriodUI(expenseLimitPeriod);
        if (dailyLimitModal) dailyLimitModal.classList.add('active');
        if (dailyLimitInput) dailyLimitInput.focus();
    };

    const closeDailyLimitModal = () => {
        if (dailyLimitModal) dailyLimitModal.classList.remove('active');
    };

    const btnEditDailyLimit = document.getElementById('btn-edit-daily-limit');
    if (btnEditDailyLimit) btnEditDailyLimit.addEventListener('click', openDailyLimitModal);
    if (closeDailyLimitModalBtn) closeDailyLimitModalBtn.addEventListener('click', closeDailyLimitModal);
    if (dailyLimitCancelBtn) dailyLimitCancelBtn.addEventListener('click', closeDailyLimitModal);

    if (dailyLimitForm) {
        dailyLimitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = parseFloat(dailyLimitInput.value);
            if (val && !isNaN(val) && val > 0) {
                if (selectedLimitPeriod === 'month') {
                    monthlyExpenseLimit = val;
                    dailyExpenseLimit = val / 30;
                    weeklyExpenseLimit = dailyExpenseLimit * 7;
                } else if (selectedLimitPeriod === 'week') {
                    weeklyExpenseLimit = val;
                    dailyExpenseLimit = val / 7;
                    monthlyExpenseLimit = dailyExpenseLimit * 30;
                } else {
                    dailyExpenseLimit = val;
                    weeklyExpenseLimit = val * 7;
                    monthlyExpenseLimit = val * 30;
                }
                expenseLimitPeriod = selectedLimitPeriod;
                saveToLocalStorage();
                syncData();
                renderAll();
                closeDailyLimitModal();

                const toastText = selectedLimitPeriod === 'month'
                    ? 'Limite mensal de despesas atualizado'
                    : (selectedLimitPeriod === 'week' ? 'Limite semanal de despesas atualizado' : 'Limite diário de despesas atualizado');
                showToast(toastText, 'success');
            }
        });
    }

    // Full Expenses History Modal Handlers
    const renderAllExpensesModal = () => {
        const modalList = document.getElementById('all-expenses-modal-list');
        const mobileModalList = document.getElementById('mobile-all-expenses-modal-list');
        const modalTotal = document.getElementById('all-expenses-modal-total');
        const searchInput = document.getElementById('all-expenses-search');
        if (!modalList) return;

        modalList.innerHTML = '';
        if (mobileModalList) mobileModalList.innerHTML = '';

        const searchQ = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const expenseTx = transactions.filter(t => {
            const isExpense = t.type === 'expense' || (t.category === 'Envelopes' && t.type !== 'income');
            const matchesSearch = !searchQ || (t.description && t.description.toLowerCase().includes(searchQ));
            return isExpense && matchesSearch;
        });

        // Sort newest first
        expenseTx.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            const parseIdNum = (idStr) => parseFloat(String(idStr || '').replace(/[^0-9]/g, '').slice(0, 13)) || 0;
            return parseIdNum(b.id) - parseIdNum(a.id);
        });

        const totalSum = expenseTx.reduce((sum, t) => sum + (t.amount || 0), 0);
        if (modalTotal) modalTotal.textContent = formatCurrency(totalSum);

        if (expenseTx.length === 0) {
            modalList.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-brand-textSecondary opacity-50 text-xs">Sem despesas nesta categoria</td>
                </tr>`;
            if (mobileModalList) {
                mobileModalList.innerHTML = `<div class="py-12 text-center text-brand-textSecondary opacity-50 text-xs">Sem despesas nesta categoria</div>`;
            }
            return;
        }

        expenseTx.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = `hover:bg-[#161619] transition-colors group`;
            const iconName = getCategoryIcon(t.category || t.description, t.type);

            tr.innerHTML = `
                <td class="py-3 px-3 text-brand-textSecondary font-medium text-xs">${formatDateString(t.date)}</td>
                <td class="py-3 px-3 font-semibold flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-brand-purpleDim text-brand-purple border border-[#202024] flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-[15px]">${iconName}</span>
                    </span>
                    <span class="truncate max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</span>
                </td>
                <td class="py-3 px-3 text-brand-textSecondary font-semibold text-xs hidden sm:table-cell">${t.category || getCategoryName(t.description, t.type)}</td>
                <td class="py-3 px-3 text-xs hidden sm:table-cell">
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#202024] text-[9px] uppercase tracking-widest font-semibold text-white">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Concluído
                    </span>
                </td>
                <td class="py-3 px-3 text-right font-outfit text-sm font-semibold tracking-tight text-white">-${formatCurrency(t.amount)}</td>
                <td class="py-3 px-3 text-right">
                    <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </td>
            `;

            tr.querySelector('.delete-button').addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                await handleDeleteTransaction(id);
                renderAllExpensesModal();
            });

            modalList.appendChild(tr);

            // Render mobile card item
            if (mobileModalList) {
                const card = document.createElement('div');
                card.className = 'bg-[#161619] border border-[#202024] p-3 rounded-2xl flex items-center justify-between hover:border-brand-purple transition-all group';

                const iconName = getCategoryIcon(t.category || t.description, t.type);

                card.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-9 h-9 rounded-xl bg-brand-purpleDim text-brand-purple border border-[#202024] flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-[17px]">${iconName}</span>
                        </span>
                        <div class="min-w-0">
                            <p class="font-semibold text-xs text-white truncate max-w-[130px] sm:max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</p>
                            <p class="text-[10px] text-brand-textSecondary font-medium mt-0.5">${formatDateString(t.date)} • ${t.category || getCategoryName(t.description, t.type)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="font-outfit text-xs font-bold tracking-tight text-white">-${formatCurrency(t.amount)}</span>
                        <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>
                `;

                card.querySelector('.delete-button').addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    await handleDeleteTransaction(id);
                    renderAllExpensesModal();
                });

                mobileModalList.appendChild(card);
            }
        });
    };

    const btnShowAllExpenses = document.getElementById('btn-show-all-expenses');
    const allExpensesModal = document.getElementById('all-expenses-modal');
    const closeAllExpensesModalBtn = document.getElementById('close-all-expenses-modal');
    const allExpensesSearch = document.getElementById('all-expenses-search');

    if (btnShowAllExpenses) {
        btnShowAllExpenses.addEventListener('click', () => {
            if (allExpensesSearch) allExpensesSearch.value = '';
            renderAllExpensesModal();
            if (allExpensesModal) allExpensesModal.classList.add('active');
        });
    }

    if (closeAllExpensesModalBtn) {
        closeAllExpensesModalBtn.addEventListener('click', () => {
            if (allExpensesModal) allExpensesModal.classList.remove('active');
        });
    }

    if (allExpensesSearch) {
        allExpensesSearch.addEventListener('input', () => {
            renderAllExpensesModal();
        });
    }

    // Full Income History Modal Handlers
    const renderAllIncomeModal = () => {
        const modalList = document.getElementById('all-income-modal-list');
        const mobileModalList = document.getElementById('mobile-all-income-modal-list');
        const modalTotal = document.getElementById('all-income-modal-total');
        const searchInput = document.getElementById('all-income-search');
        if (!modalList) return;

        modalList.innerHTML = '';
        if (mobileModalList) mobileModalList.innerHTML = '';

        const searchQ = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const incomeTx = transactions.filter(t => {
            const isIncome = t.type === 'income';
            const matchesSearch = !searchQ || (t.description && t.description.toLowerCase().includes(searchQ));
            return isIncome && matchesSearch;
        });

        // Sort newest first
        incomeTx.sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            const parseIdNum = (idStr) => parseFloat(String(idStr || '').replace(/[^0-9]/g, '').slice(0, 13)) || 0;
            return parseIdNum(b.id) - parseIdNum(a.id);
        });

        const totalSum = incomeTx.reduce((sum, t) => sum + (t.amount || 0), 0);
        if (modalTotal) modalTotal.textContent = formatCurrency(totalSum);

        if (incomeTx.length === 0) {
            modalList.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-brand-textSecondary opacity-50 text-xs">Sem rendimentos nesta categoria</td>
                </tr>`;
            if (mobileModalList) {
                mobileModalList.innerHTML = `<div class="py-12 text-center text-brand-textSecondary opacity-50 text-xs">Sem rendimentos nesta categoria</div>`;
            }
            return;
        }

        incomeTx.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = `hover:bg-[#161619] transition-colors group`;
            const iconName = getCategoryIcon(t.category || t.description, t.type);

            tr.innerHTML = `
                <td class="py-3 px-3 text-brand-textSecondary font-medium text-xs">${formatDateString(t.date)}</td>
                <td class="py-3 px-3 font-semibold flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-brand-accentDim text-brand-accent border border-[#202024] flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-[15px]">${iconName}</span>
                    </span>
                    <span class="truncate max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</span>
                </td>
                <td class="py-3 px-3 text-brand-textSecondary font-semibold text-xs hidden sm:table-cell">${t.category || getCategoryName(t.description, t.type)}</td>
                <td class="py-3 px-3 text-xs hidden sm:table-cell">
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#202024] text-[9px] uppercase tracking-widest font-semibold text-white">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Concluído
                    </span>
                </td>
                <td class="py-3 px-3 text-right font-outfit text-sm font-semibold tracking-tight text-white">+${formatCurrency(t.amount)}</td>
                <td class="py-3 px-3 text-right">
                    <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </td>
            `;

            tr.querySelector('.delete-button').addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                await handleDeleteTransaction(id);
                renderAllIncomeModal();
            });

            modalList.appendChild(tr);

            // Render mobile card item
            if (mobileModalList) {
                const card = document.createElement('div');
                card.className = 'bg-[#161619] border border-[#202024] p-3 rounded-2xl flex items-center justify-between hover:border-brand-accent transition-all group';

                card.innerHTML = `
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-9 h-9 rounded-xl bg-brand-accentDim text-brand-accent border border-[#202024] flex items-center justify-center flex-shrink-0">
                            <span class="material-symbols-outlined text-[17px]">${iconName}</span>
                        </span>
                        <div class="min-w-0">
                            <p class="font-semibold text-xs text-white truncate max-w-[130px] sm:max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</p>
                            <p class="text-[10px] text-brand-textSecondary font-medium mt-0.5">${formatDateString(t.date)} • ${t.category || getCategoryName(t.description, t.type)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="font-outfit text-xs font-bold tracking-tight text-white">+${formatCurrency(t.amount)}</span>
                        <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    </div>
                `;

                card.querySelector('.delete-button').addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    await handleDeleteTransaction(id);
                    renderAllIncomeModal();
                });

                mobileModalList.appendChild(card);
            }
        });
    };

    const btnShowAllIncome = document.getElementById('btn-show-all-income');
    const allIncomeModal = document.getElementById('all-income-modal');
    const closeAllIncomeModalBtn = document.getElementById('close-all-income-modal');
    const allIncomeSearch = document.getElementById('all-income-search');

    if (btnShowAllIncome) {
        btnShowAllIncome.addEventListener('click', () => {
            if (allIncomeSearch) allIncomeSearch.value = '';
            renderAllIncomeModal();
            if (allIncomeModal) allIncomeModal.classList.add('active');
        });
    }

    if (closeAllIncomeModalBtn) {
        closeAllIncomeModalBtn.addEventListener('click', () => {
            if (allIncomeModal) allIncomeModal.classList.remove('active');
        });
    }

    if (allIncomeSearch) {
        allIncomeSearch.addEventListener('input', () => {
            renderAllIncomeModal();
        });
    }

    // Category Details Modal Global Handlers
    let currentCategoryModalState = { catName: null, targetDateStr: null };

    window.showCategoryModal = function (catName, targetDateStr = null) {
        console.log('[showCategoryModal] Triggered for category:', catName, 'targetDateStr:', targetDateStr);
        currentCategoryModalState = { catName, targetDateStr };

        const modal = document.getElementById('category-details-modal');
        if (!modal) {
            console.error('[showCategoryModal] Modal element #category-details-modal not found!');
            return;
        }

        const modalTitle = document.getElementById('category-details-title');
        const modalSubtitle = document.getElementById('category-details-subtitle');
        const modalIcon = document.getElementById('category-details-icon');
        const modalTotal = document.getElementById('category-details-total');
        const searchInput = document.getElementById('category-details-search');
        const tableBody = document.getElementById('category-details-modal-table-list');
        const itemsList = document.getElementById('category-details-items-list');

        if (modalTitle) modalTitle.textContent = catName;
        if (modalIcon) modalIcon.textContent = getCategoryIcon(catName, 'expense');

        let currPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        let periodText = `Despesas de ${UK_MONTH_NAMES[selectedMonth]} ${selectedYear}`;

        if (targetDateStr && targetDateStr.length >= 7) {
            currPrefix = targetDateStr.substring(0, 7);
            const parts = currPrefix.split('-');
            const monthIdx = parseInt(parts[1], 10) - 1;
            if (monthIdx >= 0 && monthIdx < 12) {
                periodText = `Despesas de ${UK_MONTH_NAMES[monthIdx]} ${parts[0]}`;
            }
        }
        if (modalSubtitle) modalSubtitle.textContent = periodText;

        const norm = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const targetNorm = norm(catName);

        // 1. Primary filter: Filter transactions for this category in target month
        let catTx = transactions.filter(t => {
            if (!t) return false;
            ensureTxType(t);
            if (t.type !== 'expense' || !t.date || !t.date.startsWith(currPrefix)) return false;
            const calculatedCat = getCategoryName(t.description, t.type);
            const actualCat = (t.category && t.category !== 'Despesa' && t.category !== 'Diversos' && t.category !== 'Entrada por voz')
                ? t.category
                : calculatedCat;
            return norm(actualCat) === targetNorm || norm(calculatedCat) === targetNorm || norm(t.category) === targetNorm;
        });

        // 2. Global fallback filter: If 0 transactions found in target month, search all transactions across all time
        if (catTx.length === 0) {
            catTx = transactions.filter(t => {
                if (!t) return false;
                ensureTxType(t);
                if (t.type !== 'expense') return false;
                const calculatedCat = getCategoryName(t.description, t.type);
                const actualCat = (t.category && t.category !== 'Despesa' && t.category !== 'Diversos' && t.category !== 'Entrada por voz')
                    ? t.category
                    : calculatedCat;
                return norm(actualCat) === targetNorm || norm(calculatedCat) === targetNorm || norm(t.category) === targetNorm;
            });
            if (modalSubtitle && catTx.length > 0) {
                modalSubtitle.textContent = `Todas as despesas desta categoria`;
            }
        }

        // Apply search query filter if user typed in category modal search box
        const searchQ = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (searchQ) {
            catTx = catTx.filter(t => t.description && t.description.toLowerCase().includes(searchQ));
        }

        // Sort newest first
        catTx.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        const totalCatSum = catTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        if (modalTotal) modalTotal.textContent = formatCurrency(totalCatSum);

        // Render Desktop Table List
        if (tableBody) {
            tableBody.innerHTML = '';
            if (catTx.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-10 text-center text-brand-textSecondary opacity-60 text-xs">Sem despesas nesta categoria</td>
                    </tr>`;
            } else {
                catTx.forEach(t => {
                    const tr = document.createElement('tr');
                    tr.className = `hover:bg-[#161619] transition-colors group`;
                    const iconName = getCategoryIcon(t.category || t.description, t.type);

                    tr.innerHTML = `
                        <td class="py-3 px-3 text-brand-textSecondary font-medium text-xs">${formatDateString(t.date)}</td>
                        <td class="py-3 px-3 font-semibold flex items-center gap-3">
                            <span class="w-7 h-7 rounded-lg bg-brand-purpleDim text-brand-purple border border-[#202024] flex items-center justify-center flex-shrink-0">
                                <span class="material-symbols-outlined text-[15px]">${iconName}</span>
                            </span>
                            <span class="truncate max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</span>
                        </td>
                        <td class="py-3 px-3 text-xs hidden sm:table-cell">
                            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#202024] text-[9px] uppercase tracking-widest font-semibold text-white">
                                <span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Concluído
                            </span>
                        </td>
                        <td class="py-3 px-3 text-right font-outfit text-sm font-semibold tracking-tight text-white">-${formatCurrency(t.amount)}</td>
                        <td class="py-3 px-3 text-right">
                            <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </td>
                    `;

                    tr.querySelector('.delete-button').addEventListener('click', async (e) => {
                        const id = e.currentTarget.dataset.id;
                        await handleDeleteTransaction(id);
                        window.showCategoryModal(catName, targetDateStr);
                    });

                    tableBody.appendChild(tr);
                });
            }
        }

        // Render Mobile Cards List
        if (itemsList) {
            itemsList.innerHTML = '';
            if (catTx.length === 0) {
                itemsList.innerHTML = `<div class="py-8 text-center text-xs text-brand-textSecondary opacity-70">Sem despesas nesta categoria</div>`;
            } else {
                catTx.forEach(t => {
                    const card = document.createElement('div');
                    card.className = 'bg-[#161619] border border-[#202024] p-3 rounded-2xl flex items-center justify-between hover:border-brand-purple transition-all group';
                    const iconName = getCategoryIcon(t.category || t.description, t.type);

                    card.innerHTML = `
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-9 h-9 rounded-xl bg-brand-purpleDim text-brand-purple border border-[#202024] flex items-center justify-center flex-shrink-0">
                                <span class="material-symbols-outlined text-[17px]">${iconName}</span>
                            </span>
                            <div class="min-w-0">
                                <p class="font-semibold text-xs text-white truncate max-w-[130px] sm:max-w-[200px] flex items-center" title="${escapeHtml(t.description)}"><span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}</p>
                                <p class="text-[10px] text-brand-textSecondary font-medium mt-0.5">${formatDateString(t.date)}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="font-outfit text-xs font-bold tracking-tight text-white">-${formatCurrency(t.amount)}</span>
                            <button class="delete-button text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${t.id}" title="Eliminar">
                                <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    `;

                    card.querySelector('.delete-button').addEventListener('click', async (e) => {
                        const id = e.currentTarget.dataset.id;
                        await handleDeleteTransaction(id);
                        window.showCategoryModal(catName, targetDateStr);
                    });

                    itemsList.appendChild(card);
                });
            }
        }

        modal.classList.add('active');
        modal.style.cssText = 'display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; z-index: 999999 !important;';
    };

    window.closeCategoryModal = function () {
        const modal = document.getElementById('category-details-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.cssText = '';
        }
    };

    window.openCategoryDetailsModal = window.showCategoryModal;
    window.closeCategoryDetailsModal = window.closeCategoryModal;
    function openCategoryDetailsModal(catName, targetDateStr) { window.showCategoryModal(catName, targetDateStr); }
    function closeCategoryDetailsModal() { window.closeCategoryModal(); }

    const closeCategoryDetailsModalBtn = document.getElementById('close-category-details-modal');
    const categoryDetailsSearchInput = document.getElementById('category-details-search');

    if (closeCategoryDetailsModalBtn) {
        closeCategoryDetailsModalBtn.addEventListener('click', () => {
            window.closeCategoryModal();
        });
    }

    if (categoryDetailsSearchInput) {
        categoryDetailsSearchInput.addEventListener('input', () => {
            if (currentCategoryModalState.catName) {
                window.showCategoryModal(currentCategoryModalState.catName, currentCategoryModalState.targetDateStr);
            }
        });
    }

    // Global Event Delegation for Category Clicks Anywhere on the Page
    document.addEventListener('click', (e) => {
        const catTarget = e.target.closest('[data-category], .category-badge, .category-click');
        if (catTarget) {
            const catName = catTarget.dataset.category || (catTarget.dataset.category !== undefined ? catTarget.dataset.category : null);
            if (catName && catName !== 'Despesa' && catName !== 'Rendimento' && catName !== 'Diversos' && catName !== 'Categoria') {
                e.preventDefault();
                e.stopPropagation();
                const txDate = catTarget.dataset.date || null;
                window.showCategoryModal(catName, txDate);
            }
        }
    });

    // Toast Notification Helper
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let iconName = 'info';
        if (type === 'success') iconName = 'check_circle';
        else if (type === 'recurring') iconName = 'sync';
        else if (type === 'delete') iconName = 'delete';

        toast.innerHTML = `
            <span class="material-symbols-outlined text-[16px]">${iconName}</span>
            <span>${escapeHtml(message)}</span>
        `;

        toastContainer.appendChild(toast);

        // Trigger reflow to apply animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    };

    // 4. Utility Functions
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    };

    const formatDateToLocal = (date) => {
        // Format to match "Wed, 29 May 2024" format (Ukrainian equivalent or similar)
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const d = date.getDate();
        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        const y = date.getFullYear();
        return `${dayName}, ${d} ${monthName} ${y}`;
    };

    const formatDateString = (dateStr) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return dateStr;
    };

    // 5. Theme Handlers
    const initTheme = () => {
        const savedTheme = localStorage.getItem('mono_theme');
        const html = document.documentElement;

        if (savedTheme) {
            if (savedTheme === 'light') {
                html.classList.remove('dark');
            } else {
                html.classList.add('dark');
            }
        } else {
            // Default to dark theme as requested for "stylish minimalist B&W"
            html.classList.add('dark');
        }
    };

    const toggleTheme = () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('mono_theme', 'light');
            showToast('Tema claro ativado');
        } else {
            html.classList.add('dark');
            localStorage.setItem('mono_theme', 'dark');
            showToast('Tema escuro ativado');
        }
    };

    // 6. Automatic Recurring Debits Handlers
    const processRecurringDebits = () => {
        const today = new Date();
        const todayStr = getLocalDateString(today);
        const todayDayNum = today.getDate();

        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDayObj = new Date(year, month + 1, 0);
        const maxDayInMonth = lastDayObj.getDate();

        let addedCount = 0;

        recurringExpenses.forEach(item => {
            const scheduledDays = item.days || [item.dayOfMonth || 1];
            scheduledDays.forEach(scheduledDay => {
                const isDueToday = (todayDayNum === scheduledDay) || (todayDayNum === maxDayInMonth && scheduledDay > maxDayInMonth);

                if (isDueToday) {
                    const targetDescription = item.description + ' (Despesa automática)';
                    const alreadyExists = transactions.some(t => t.type === 'expense' && t.description === targetDescription && t.date === todayStr);

                    if (!alreadyExists) {
                        const newTx = {
                            id: (Date.now() + Math.random()).toString(),
                            amount: item.amount,
                            type: 'expense',
                            description: targetDescription,
                            date: todayStr
                        };
                        transactions.push(newTx);
                        addedCount++;
                    }
                }
            });
        });

        if (addedCount > 0) {
            syncData();
            showToast(`Despesa automática processada ${addedCount} despesas regulares`);
        }
    };

    const renderRecurringExpenses = () => {
        if (!recurringExpensesList) return;
        recurringExpensesList.innerHTML = '';

        if (recurringExpenses.length === 0) {
            recurringExpensesList.innerHTML = `
                <div class="text-xs text-brand-textSecondary text-center py-6 opacity-50">Sem despesas automáticas</div>
            `;
            return;
        }

        recurringExpenses.forEach(item => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-black border border-[#202024] rounded-xl px-4 py-3 group hover:border-brand-purple transition-all';
            const scheduledDays = item.days || [item.dayOfMonth || 1];
            const daysText = scheduledDays.length === 1
                ? `${scheduledDays[0]}-th de cada mês`
                : `dias: ${scheduledDays.join(', ')} de cada mês`;

            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-brand-purpleDim text-brand-purple flex items-center justify-center border border-[#202024]">
                        <span class="material-symbols-outlined text-[15px]">sync</span>
                    </span>
                    <div>
                        <p class="text-xs font-semibold text-white truncate max-w-[150px]" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</p>
                        <p class="text-[9px] text-brand-textSecondary">${daysText}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-white font-outfit font-semibold">${formatCurrency(item.amount)}</span>
                    <button class="delete-recurring-btn text-brand-textSecondary hover:text-red-400 p-1 rounded-lg hover:bg-[#202024] transition-colors" data-id="${item.id}" title="Eliminar">
                        <span class="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            `;

            div.querySelector('.delete-recurring-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                handleDeleteRecurring(id);
            });

            recurringExpensesList.appendChild(div);
        });
    };

    const handleRecurringSubmit = (e) => {
        e.preventDefault();
        const amountEl = document.getElementById('recurring-amount');
        const descriptionEl = document.getElementById('recurring-description');
        const daysSelectedEl = document.getElementById('recurring-days-selected');

        const amount = parseFloat(amountEl.value);
        const description = descriptionEl.value.trim();
        const daysVal = daysSelectedEl.value;

        if (!amount || isNaN(amount) || amount <= 0 || !description) return;
        if (!daysVal) {
            showToast('Selecione pelo menos um dia no calendário', 'info');
            return;
        }

        const daysArray = daysVal.split(',').map(Number);

        const newRecurring = {
            id: Date.now().toString(),
            amount,
            description,
            days: daysArray
        };

        recurringExpenses.push(newRecurring);
        syncData();
        renderRecurringExpenses();
        formAddRecurring.reset();

        // Reset calendar buttons visual state
        const daysGrid = document.getElementById('recurring-days-grid');
        if (daysGrid) {
            daysGrid.querySelectorAll('button').forEach(btn => {
                btn.className = 'w-7 h-7 rounded-lg text-[10px] font-semibold flex items-center justify-center border border-[#202024] hover:border-brand-purple text-brand-textSecondary transition-all';
            });
        }
        document.getElementById('recurring-days-selected').value = '';

        showToast('Despesa automática adicionada com sucesso', 'success');

        // Refresh dashboard metrics
        renderAll();
    };

    const handleDeleteRecurring = async (id) => {
        const item = recurringExpenses.find(r => String(r.id) === String(id));
        const desc = item ? `«${item.description}»` : 'esta despesa automática';

        const confirmed = await showConfirm(
            'Eliminar despesa automática',
            `Tem a certeza de que pretende eliminar ${desc}?`,
            'Eliminar',
            'Cancelar'
        );

        if (confirmed) {
            recurringExpenses = recurringExpenses.filter(r => String(r.id) !== String(id));
            syncData();
            renderRecurringExpenses();
            renderAll();
            showToast('Despesa automática eliminada', 'delete');
        }
    };

    /* Ukrainian Voice Text Parser for SwiftFinance (Ported 1-to-1 from Android Kotlin) */
    const isNumericOrNumberWord = (word) => {
        if (!word) return false;
        const cleanWord = word.toLowerCase().replace(/[^a-zа-яєіїґ0-9.,']/gi, '');
        if (/^\d+(?:[.,]\d+)?$/.test(cleanWord)) return true;

        const numberWords = new Set([
            'один', 'одна', 'одне', 'два', 'дві', 'три', 'чотири',
            'п\'ять', 'пять', 'п’ять', 'шість', 'сім', 'вісім', 'дев\'ять', 'девять', 'десять',
            'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', 'п\'ятнадцять', 'пятнадцять',
            'шістнадцять', 'сімнадцять', 'вісімнадцять', 'дев\'ятнадцять', 'девятнадцять',
            'двадцять', 'тридцять', 'сорок', 'п\'ятдесят', 'пятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'дев\'яносто', 'девяносто',
            'сто', 'двісті', 'триста', 'чотириста', 'п\'ятсот', 'пятсот', 'шістсот', 'сімсот', 'вісімсот', 'дев\'ятсот', 'девятсот',
            'тисяча', 'тисячі', 'тисяч'
        ]);
        return numberWords.has(cleanWord);
    };

    const extractNumberFromWords = (amtWords) => {
        if (!amtWords || amtWords.length === 0) return 0;
        const numberWordsMap = {
            'нуль': 0, 'один': 1, 'одна': 1, 'два': 2, 'дві': 2, 'три': 3, 'чотири': 4, 'п\'ять': 5, 'пять': 5,
            'шість': 6, 'сім': 7, 'вісім': 8, 'дев\'ять': 9, 'девять': 9, 'десять': 10,
            'одинадцять': 11, 'дванадцять': 12, 'тринадцять': 13, 'чотирнадцять': 14, 'п\'ятнадцять': 15, 'пятнадцять': 15,
            'шістнадцять': 16, 'сімнадцять': 17, 'вісімнадцять': 18, 'дев\'ятнадцять': 19, 'девятнадцять': 19, 'двадцять': 20,
            'тридцять': 30, 'сорок': 40, 'п\'ятдесят': 50, 'пятдесят': 50, 'шістдесят': 60,
            'сімдесят': 70, 'вісімдесят': 80, 'дев\'яносто': 90, 'девяносто': 90,
            'сто': 100, 'двісті': 200, 'триста': 300, 'чотириста': 400, 'п\'ятсот': 500, 'пятсот': 500,
            'шістсот': 600, 'сімсот': 700, 'вісімсот': 800, 'дев\'ятсот': 900, 'девятсот': 900,
            'тисяча': 1000, 'тисячі': 1000, 'тисяч': 1000
        };

        let total = 0;
        amtWords.forEach(w => {
            const clean = w.replace(/[^a-zа-яєіїґ0-9.,']/gi, '').toLowerCase();
            const digitMatch = clean.match(/(\d+(?:[.,]\d+)?)/);
            if (digitMatch) {
                total += parseFloat(digitMatch[1].replace(',', '.'));
            } else if (numberWordsMap[clean] !== undefined) {
                total += numberWordsMap[clean];
            }
        });
        return total;
    };

    const cleanDescriptionWords = (descWords) => {
        if (!descWords || descWords.length === 0) return '';
        const removeWords = new Set([
            'гривень', 'гривні', 'гривня', 'грн', 'доларів', 'долари', 'євро',
            'купив', 'купила', 'витратив', 'витратила', 'заплатив', 'заплатила',
            'на', 'за', 'в', 'у'
        ]);
        const filtered = descWords.filter(w => {
            const clean = w.replace(/[^a-zа-яєіїґ']/gi, '').toLowerCase();
            return clean && !removeWords.has(clean);
        });
        const result = filtered.join(' ').trim();
        if (!result) return '';
        return result.charAt(0).toUpperCase() + result.slice(1);
    };

    const parseVoiceText = (text) => {
        if (!text || typeof text !== 'string') return [];

        const words = text.split(/\s+/);
        const parsedItems = [];

        let currentDesc = [];
        let currentAmt = [];
        const conjunctions = new Set(['і', 'й', 'та', 'також', 'ще', 'плюс', 'а', 'але']);
        const incomeKeywords = ['стипендія', 'стипендію', 'зарплата', 'зарплату', 'чайові', 'чайових', 'аванс', 'премія', 'премію', 'фриланс', 'прибуток'];

        const saveCurrentItem = () => {
            const cleanDesc = cleanDescriptionWords(currentDesc);
            const amount = extractNumberFromWords(currentAmt);

            if (cleanDesc.length > 0 || amount > 0) {
                const finalDesc = cleanDesc.length > 0 ? cleanDesc : 'Despesa';
                const descLower = finalDesc.toLowerCase();
                const isIncome = incomeKeywords.some(kw => descLower.includes(kw));
                const itemType = isIncome ? 'income' : 'expense';

                parsedItems.push({ description: finalDesc, amount: amount, type: itemType });
            }
            currentDesc = [];
            currentAmt = [];
        };

        for (const word of words) {
            const cleanWord = word.replace(/[^a-zа-яєіїґ']/gi, '').toLowerCase();
            if (conjunctions.has(cleanWord)) {
                if (currentDesc.length > 0 && currentAmt.length > 0) {
                    saveCurrentItem();
                }
                continue;
            }

            if (isNumericOrNumberWord(word)) {
                currentAmt.push(word);
            } else {
                if (currentAmt.length > 0) {
                    saveCurrentItem();
                }
                currentDesc.push(word);
            }
        }

        if (currentDesc.length > 0 || currentAmt.length > 0) {
            saveCurrentItem();
        }

        return parsedItems;
    };


    // Voice Recognition Controller
    let recognition = null;
    let isRecording = false;
    let isVoiceSaving = false;
    let mediaStream = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isMediaRecording = false;

    const initVoiceRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const voiceModal = document.getElementById('voice-modal');
        const closeVoiceModalBtn = document.getElementById('close-voice-modal-btn');
        const sidebarVoiceBtn = document.getElementById('sidebar-voice-btn');
        const mobileVoiceBtn = document.getElementById('mobile-voice-btn');
        const voiceRecordPulseBtn = document.getElementById('voice-record-pulse-btn');
        const voiceStatusText = document.getElementById('voice-status-text');
        const voiceTranscriptPreview = document.getElementById('voice-transcript-preview');
        const voiceParsedContainer = document.getElementById('voice-parsed-container');
        const voiceItemsList = document.getElementById('voice-items-list');
        const addVoiceItemBtn = document.getElementById('add-voice-item-btn');
        const voiceCancelBtn = document.getElementById('voice-cancel-btn');
        const voiceSaveBtn = document.getElementById('voice-save-btn');

        if (!voiceModal) return;

        const openVoiceModal = () => {
            isVoiceSaving = false;
            if (voiceSaveBtn) {
                voiceSaveBtn.disabled = false;
                voiceSaveBtn.classList.remove('opacity-50', 'pointer-events-none');
            }
            voiceModal.classList.add('active');
            if (voiceParsedContainer) voiceParsedContainer.classList.add('hidden');
            if (voiceTranscriptPreview) voiceTranscriptPreview.textContent = '"Ex: Café 75 e almoço 200"';
            if (voiceStatusText) voiceStatusText.textContent = 'Prima o microfone e fale';
            if (voiceItemsList) voiceItemsList.innerHTML = '';

            const hasMediaRecorder = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
            if (SpeechRecognition || hasMediaRecorder) {
                startRecording();
            } else {
                if (voiceStatusText) voiceStatusText.textContent = 'Entrada por voz não suportada neste navegador';
                showToast('Microfone indisponível neste navegador', 'info');
            }
        };

        const closeVoiceModal = () => {
            stopRecording();
            voiceModal.classList.remove('active');
            isVoiceSaving = false;
            if (voiceSaveBtn) {
                voiceSaveBtn.disabled = false;
                voiceSaveBtn.classList.remove('opacity-50', 'pointer-events-none');
            }
        };

        const sendAudioForTranscription = async (blob) => {
            if (voiceStatusText) {
                voiceStatusText.textContent = 'A reconhecer voz (Whisper AI)...';
                voiceStatusText.classList.add('text-brand-accent');
            }
            if (voiceTranscriptPreview) {
                voiceTranscriptPreview.textContent = '"A processar gravação..."';
            }

            try {
                const formData = new FormData();
                const mime = blob.type || '';
                const ext = mime.includes('mp4') || mime.includes('aac') ? 'mp4' : (mime.includes('webm') ? 'webm' : 'wav');
                formData.append('audio', blob, `voice_${Date.now()}.${ext}`);

                const response = await fetch('/api/voice-transcribe', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.success && data.text) {
                    if (voiceTranscriptPreview) {
                        voiceTranscriptPreview.textContent = `"${data.text}"`;
                    }
                    handleVoiceResult(data.text);
                } else {
                    if (voiceStatusText) {
                        voiceStatusText.textContent = data.message || 'Não foi possível reconhecer a voz. Tente novamente';
                    }
                }
            } catch (err) {
                console.error('Transcription error:', err);
                if (voiceStatusText) {
                    voiceStatusText.textContent = 'Erro de ligação ao servidor de reconhecimento';
                }
            } finally {
                if (voiceStatusText) voiceStatusText.classList.remove('text-brand-accent');
            }
        };

        const startMediaRecording = async () => {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
                    if (voiceStatusText) voiceStatusText.textContent = 'Entrada por voz não suportada pelo dispositivo';
                    showToast('Microfone ou gravação de áudio indisponível', 'info');
                    return;
                }

                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                let mimeType = '';
                if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/aac')) {
                    mimeType = 'audio/aac';
                } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
                    mimeType = 'audio/webm';
                } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/wav')) {
                    mimeType = 'audio/wav';
                }

                const options = mimeType ? { mimeType } : {};
                mediaRecorder = new MediaRecorder(mediaStream, options);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    isMediaRecording = false;
                    isRecording = false;
                    if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.remove('mic-recording');

                    if (mediaStream) {
                        mediaStream.getTracks().forEach(track => track.stop());
                        mediaStream = null;
                    }

                    if (audioChunks.length > 0) {
                        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/mp4' });
                        await sendAudioForTranscription(audioBlob);
                    }
                };

                mediaRecorder.start();
                isMediaRecording = true;
                isRecording = true;

                if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.add('mic-recording');
                if (voiceStatusText) {
                    voiceStatusText.textContent = 'A ouvir... Fale (Prima novamente para terminar)';
                    voiceStatusText.classList.add('text-brand-accent');
                }
            } catch (err) {
                console.error('MediaRecorder start error:', err);
                isMediaRecording = false;
                isRecording = false;
                if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.remove('mic-recording');
                if (voiceStatusText) {
                    voiceStatusText.textContent = 'Conceda permissão para usar o microfone';
                    voiceStatusText.classList.remove('text-brand-accent');
                }
                showToast('É necessária permissão do microfone nas definições do Safari', 'info');
            }
        };

        const startRecording = () => {
            if (isRecording) return;

            if (SpeechRecognition) {
                try {
                    if (recognition) {
                        try { recognition.abort(); } catch (e) { }
                    }

                    recognition = new SpeechRecognition();
                    recognition.lang = 'pt-PT';
                    recognition.continuous = false;
                    recognition.interimResults = true;

                    recognition.onstart = () => {
                        isRecording = true;
                        if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.add('mic-recording');
                        if (voiceStatusText) {
                            voiceStatusText.textContent = 'A ouvir... Fale';
                            voiceStatusText.classList.add('text-brand-accent');
                        }
                    };

                    recognition.onresult = (event) => {
                        let interimTranscript = '';
                        let finalTranscript = '';

                        for (let i = event.resultIndex; i < event.results.length; ++i) {
                            if (event.results[i].isFinal) {
                                finalTranscript += event.results[i][0].transcript;
                            } else {
                                interimTranscript += event.results[i][0].transcript;
                            }
                        }

                        const currentText = finalTranscript || interimTranscript;
                        if (currentText && voiceTranscriptPreview) {
                            voiceTranscriptPreview.textContent = `"${currentText}"`;
                        }

                        if (finalTranscript) {
                            handleVoiceResult(finalTranscript);
                        }
                    };

                    recognition.onerror = (event) => {
                        isRecording = false;
                        if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.remove('mic-recording');
                        if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
                            startMediaRecording();
                        } else if (voiceStatusText) {
                            if (event.error === 'no-speech') {
                                voiceStatusText.textContent = 'Voz não detetada. Prima novamente';
                            } else {
                                voiceStatusText.textContent = `Erro de reconhecimento: ${event.error}`;
                            }
                        }
                    };

                    recognition.onend = () => {
                        isRecording = false;
                        if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.remove('mic-recording');
                        if (voiceStatusText) voiceStatusText.classList.remove('text-brand-accent');
                    };

                    recognition.start();
                } catch (err) {
                    console.error('Speech recognition error, using MediaRecorder fallback:', err);
                    startMediaRecording();
                }
            } else {
                startMediaRecording();
            }
        };

        const stopRecording = () => {
            if (recognition && isRecording && !isMediaRecording) {
                try { recognition.stop(); } catch (e) { }
                isRecording = false;
                if (voiceRecordPulseBtn) voiceRecordPulseBtn.classList.remove('mic-recording');
            }
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                try { mediaRecorder.stop(); } catch (e) { }
            }
        };

        const renderItemRow = (desc = '', amount = '', type = 'expense') => {
            const row = document.createElement('div');
            row.className = 'voice-item-row bg-[#161619] p-3.5 rounded-2xl border border-[#202024] space-y-3 sm:space-y-0 sm:flex sm:items-end gap-3 shadow-sm';
            row.innerHTML = `
                <div class="flex-1 min-w-0">
                    <label class="block text-[9px] font-bold text-brand-textSecondary uppercase tracking-widest mb-1.5 opacity-70">Descrição / Nome</label>
                    <input type="text" class="voice-item-desc w-full bg-[#111113] border border-[#202024] rounded-xl px-3 h-[38px] text-xs text-white focus:border-[#20a034] focus:outline-none transition-all" value="${escapeHtml(desc)}" placeholder="Ex: Salário ou Café">
                </div>
                <div class="w-full sm:w-28 flex-shrink-0">
                    <label class="block text-[9px] font-bold text-brand-textSecondary uppercase tracking-widest mb-1.5 opacity-70">Valor (€)</label>
                    <input type="number" step="0.01" class="voice-item-amount w-full bg-[#111113] border border-[#202024] rounded-xl px-3 h-[38px] text-xs text-white focus:border-[#20a034] focus:outline-none transition-all" value="${amount > 0 ? amount : ''}" placeholder="0.00">
                </div>
                <div class="w-full sm:w-36 flex-shrink-0">
                    <label class="block text-[9px] font-bold text-brand-textSecondary uppercase tracking-widest mb-1.5 opacity-70">Tipo de transação</label>
                    <input type="hidden" class="voice-item-type" value="${type}">
                    <div class="flex items-center bg-[#111113] border border-[#202024] p-1 rounded-xl h-[38px]">
                        <button type="button" class="voice-type-btn text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-1 text-center ${type === 'expense' ? 'bg-[#20a034]/20 text-[#A78BFA] border border-[#20a034]/40 shadow-sm' : 'text-brand-textSecondary hover:text-white'}" data-type="expense">
                            Despesa
                        </button>
                        <button type="button" class="voice-type-btn text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-1 text-center ${type === 'income' ? 'bg-[#20a034]/20 text-[#20a034] border border-[#20a034]/40 shadow-sm' : 'text-brand-textSecondary hover:text-white'}" data-type="income">
                            Rendimento
                        </button>
                    </div>
                </div>
            `;

            const hiddenTypeInput = row.querySelector('.voice-item-type');
            const typeBtns = row.querySelectorAll('.voice-type-btn');

            typeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const selectedType = btn.dataset.type;
                    hiddenTypeInput.value = selectedType;

                    typeBtns.forEach(b => {
                        if (b.dataset.type === 'expense') {
                            b.className = `voice-type-btn text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-1 text-center ${selectedType === 'expense' ? 'bg-[#20a034]/20 text-[#A78BFA] border border-[#20a034]/40 shadow-sm' : 'text-brand-textSecondary hover:text-white'}`;
                        } else {
                            b.className = `voice-type-btn text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-1 text-center ${selectedType === 'income' ? 'bg-[#20a034]/20 text-[#20a034] border border-[#20a034]/40 shadow-sm' : 'text-brand-textSecondary hover:text-white'}`;
                        }
                    });
                });
            });

            voiceItemsList.appendChild(row);
        };

        const handleVoiceResult = (text) => {
            stopRecording();
            const items = parseVoiceText(text);
            if (voiceItemsList) voiceItemsList.innerHTML = '';

            if (items && items.length > 0) {
                items.forEach(item => {
                    renderItemRow(item.description, item.amount, item.type);
                });
            } else {
                renderItemRow();
            }

            if (voiceParsedContainer) voiceParsedContainer.classList.remove('hidden');
            if (voiceStatusText) voiceStatusText.textContent = 'Verifique e guarde as transações reconhecidas';
        };

        // Add blank item button
        if (addVoiceItemBtn) {
            addVoiceItemBtn.addEventListener('click', () => {
                renderItemRow();
            });
        }

        // Event Listeners
        if (sidebarVoiceBtn) sidebarVoiceBtn.addEventListener('click', openVoiceModal);
        if (mobileVoiceBtn) mobileVoiceBtn.addEventListener('click', openVoiceModal);
        if (closeVoiceModalBtn) closeVoiceModalBtn.addEventListener('click', closeVoiceModal);
        if (voiceCancelBtn) voiceCancelBtn.addEventListener('click', closeVoiceModal);

        if (voiceRecordPulseBtn) {
            voiceRecordPulseBtn.addEventListener('click', () => {
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording();
                }
            });
        }

        if (voiceSaveBtn) {
            voiceSaveBtn.addEventListener('click', async () => {
                if (isVoiceSaving) return;
                isVoiceSaving = true;
                voiceSaveBtn.disabled = true;
                voiceSaveBtn.classList.add('opacity-50', 'pointer-events-none');

                try {
                    const rows = voiceItemsList.querySelectorAll('.voice-item-row');
                    const validItems = [];

                    rows.forEach(row => {
                        const descInput = row.querySelector('.voice-item-desc');
                        const amountInput = row.querySelector('.voice-item-amount');
                        const typeInput = row.querySelector('.voice-item-type');

                        const desc = descInput ? descInput.value.trim() : '';
                        const amount = amountInput ? parseFloat(amountInput.value) : 0;
                        const itemType = typeInput ? typeInput.value : 'expense';

                        if (amount > 0) {
                            validItems.push({ desc, amount, type: itemType });
                        }
                    });

                    if (validItems.length === 0) {
                        showToast('Introduza pelo menos um valor de transação', 'info');
                        return;
                    }

                    const baseTime = Date.now();
                    const todayStr = getLocalDateString(new Date());

                    const newTxList = await Promise.all(validItems.map(async (item, idx) => {
                        const cat = await categorizeWithAI(item.desc, item.type);
                        return {
                            id: (baseTime + (validItems.length - idx)).toString(),
                            date: todayStr,
                            amount: item.amount,
                            description: item.desc || (item.type === 'income' ? 'Rendimento por voz' : 'Despesa por voz'),
                            type: item.type,
                            category: cat
                        };
                    }));

                    for (let i = newTxList.length - 1; i >= 0; i--) {
                        transactions.unshift(newTxList[i]);
                    }

                    syncData();
                    renderAll();
                    closeVoiceModal();

                    const incomeCount = validItems.filter(i => i.type === 'income').length;
                    const expenseCount = validItems.filter(i => i.type === 'expense').length;

                    let msg = '';
                    if (incomeCount > 0 && expenseCount > 0) {
                        msg = `Adicionado com sucesso ${incomeCount} rend. e ${expenseCount} desp.!`;
                    } else if (incomeCount > 0) {
                        msg = `Adicionado com sucesso ${incomeCount} rendimentos!`;
                    } else {
                        msg = `Adicionado com sucesso ${expenseCount} despesas!`;
                    }

                    showToast(msg, 'success');
                } catch (err) {
                    console.error('Error saving voice transactions:', err);
                    showToast('Erro ao guardar transações', 'error');
                } finally {
                    isVoiceSaving = false;
                    if (voiceSaveBtn) {
                        voiceSaveBtn.disabled = false;
                        voiceSaveBtn.classList.remove('opacity-50', 'pointer-events-none');
                    }
                }
            });
        }

    };

    // -------------------------------------------------------------
    // Savings Envelopes / Goals Functions & Event Handlers
    // -------------------------------------------------------------

    const renderIconPicker = (selectedIcon = 'savings') => {
        if (!envelopeIconPicker) return;
        envelopeIconPicker.innerHTML = '';
        GOAL_ICONS.forEach(icon => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `w-9 h-9 rounded-xl flex items-center justify-center border transition-all flex-shrink-0 ${icon === selectedIcon
                ? 'border-[#20a034] bg-[#20a034]/20 text-[#20a034]'
                : 'border-[#202024] bg-black text-brand-textSecondary hover:border-[#20a034]/50'
                }`;
            btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span>`;
            btn.addEventListener('click', () => {
                if (envelopeIconVal) envelopeIconVal.value = icon;
                renderIconPicker(icon);
            });
            envelopeIconPicker.appendChild(btn);
        });
    };

    const renderColorPicker = (selectedColor = '#20a034') => {
        if (!envelopeColorPicker) return;
        envelopeColorPicker.innerHTML = '';
        GOAL_COLORS.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `w-7 h-7 rounded-full border-2 transition-all flex-shrink-0 ${color === selectedColor ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                }`;
            btn.style.backgroundColor = color;
            btn.addEventListener('click', () => {
                if (envelopeColorVal) envelopeColorVal.value = color;
                renderColorPicker(color);
            });
            envelopeColorPicker.appendChild(btn);
        });
    };

    const openEnvelopeModal = (goalId = null) => {
        renderIconPicker('savings');
        renderColorPicker('#20a034');

        if (goalId) {
            const goal = savingsGoals.find(g => String(g.id) === String(goalId));
            if (goal) {
                if (envelopeModalTitle) envelopeModalTitle.textContent = 'Editar envelope';
                if (envelopeIdInput) envelopeIdInput.value = goal.id;
                if (envelopeTitleInput) envelopeTitleInput.value = goal.title;
                if (envelopeTargetAmountInput) envelopeTargetAmountInput.value = goal.targetAmount;
                if (envelopeCurrentAmountInput) envelopeCurrentAmountInput.value = goal.currentAmount;
                if (envelopeIconVal) envelopeIconVal.value = goal.icon || 'savings';
                if (envelopeColorVal) envelopeColorVal.value = goal.color || '#20a034';
                renderIconPicker(goal.icon || 'savings');
                renderColorPicker(goal.color || '#20a034');
            }
        } else {
            if (envelopeModalTitle) envelopeModalTitle.textContent = 'Criar novo envelope';
            if (envelopeIdInput) envelopeIdInput.value = '';
            if (envelopeTitleInput) envelopeTitleInput.value = '';
            if (envelopeTargetAmountInput) envelopeTargetAmountInput.value = '';
            if (envelopeCurrentAmountInput) envelopeCurrentAmountInput.value = '0';
            if (envelopeIconVal) envelopeIconVal.value = 'savings';
            if (envelopeColorVal) envelopeColorVal.value = '#20a034';
        }

        if (envelopeModal) envelopeModal.classList.add('active');
    };

    const closeEnvelopeModal = () => {
        if (envelopeModal) envelopeModal.classList.remove('active');
    };

    const handleSaveEnvelope = (e) => {
        e.preventDefault();
        const id = envelopeIdInput ? envelopeIdInput.value.trim() : '';
        const title = envelopeTitleInput ? envelopeTitleInput.value.trim() : '';
        const targetAmount = envelopeTargetAmountInput ? parseFloat(envelopeTargetAmountInput.value) : 0;
        const currentAmount = envelopeCurrentAmountInput ? parseFloat(envelopeCurrentAmountInput.value) || 0 : 0;
        const icon = envelopeIconVal ? envelopeIconVal.value : 'savings';
        const color = envelopeColorVal ? envelopeColorVal.value : '#20a034';

        if (!title || targetAmount <= 0) {
            showToast('Introduza um nome e um valor alvo válidos', 'info');
            return;
        }

        if (id) {
            const goal = savingsGoals.find(g => String(g.id) === String(id));
            if (goal) {
                goal.title = title;
                goal.targetAmount = targetAmount;
                goal.icon = icon;
                goal.color = color;
            }
            showToast('Envelope atualizado com sucesso', 'success');
        } else {
            const newGoal = {
                id: 'goal_' + Date.now(),
                title,
                targetAmount,
                currentAmount,
                icon,
                color
            };
            savingsGoals.push(newGoal);

            showToast('Novo envelope criado com sucesso', 'success');
        }

        syncData();
        renderAll();
        closeEnvelopeModal();
    };

    function showConfirm(title, message, okText = 'Confirmar', cancelText = 'Cancelar') {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-confirm-modal');
            const titleEl = document.getElementById('confirm-modal-title');
            const msgEl = document.getElementById('confirm-modal-message');
            const okBtn = document.getElementById('confirm-btn-ok');
            const cancelBtn = document.getElementById('confirm-btn-cancel');

            if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
                resolve(window.confirm(message));
                return;
            }

            titleEl.textContent = title;
            msgEl.textContent = message;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            modal.classList.add('active');

            const cleanup = (result) => {
                modal.classList.remove('active');
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                resolve(result);
            };

            okBtn.onclick = () => cleanup(true);
            cancelBtn.onclick = () => cleanup(false);
        });
    }

    const deleteEnvelope = async (goalId) => {
        const goal = savingsGoals.find(g => String(g.id) === String(goalId));
        if (!goal) return;

        const confirmed = await showConfirm(
            'Eliminar envelope',
            `Tem a certeza de que pretende eliminar o envelope «${goal.title}»?`,
            'Eliminar',
            'Cancelar'
        );

        if (confirmed) {
            savingsGoals = savingsGoals.filter(g => String(g.id) !== String(goalId));
            syncData();
            renderAll();
            showToast('Envelope eliminado', 'delete');
        }
    };

    const setTransferType = (type) => {
        if (transferTypeVal) transferTypeVal.value = type;
        if (type === 'deposit') {
            if (transferTabDeposit) {
                transferTabDeposit.className = 'py-2 text-xs font-semibold rounded-lg bg-[#20a034] text-white transition-all';
                transferTabDeposit.textContent = 'Depositar';
            }
            if (transferTabWithdraw) {
                transferTabWithdraw.className = 'py-2 text-xs font-semibold rounded-lg text-brand-textSecondary hover:text-white transition-all';
                transferTabWithdraw.textContent = 'Levantar';
            }
            if (transferModalTitle) transferModalTitle.textContent = 'Depositar no envelope';
            if (submitTransferBtn) submitTransferBtn.textContent = 'Depositar';
        } else {
            if (transferTypeVal) transferTypeVal.value = 'withdraw';
            if (transferTabDeposit) {
                transferTabDeposit.className = 'py-2 text-xs font-semibold rounded-lg text-brand-textSecondary hover:text-white transition-all';
                transferTabDeposit.textContent = 'Depositar';
            }
            if (transferTabWithdraw) {
                transferTabWithdraw.className = 'py-2 text-xs font-semibold rounded-lg bg-[#20a034] text-white transition-all';
                transferTabWithdraw.textContent = 'Levantar';
            }
            if (transferModalTitle) transferModalTitle.textContent = 'Levantar fundos do envelope';
            if (submitTransferBtn) submitTransferBtn.textContent = 'Levantar';
        }
    };

    const openTransferModal = (goalId, initialType = 'deposit') => {
        const goal = savingsGoals.find(g => String(g.id) === String(goalId));
        if (!goal) return;

        if (transferEnvelopeIdInput) transferEnvelopeIdInput.value = goal.id;
        if (transferModalSubtitle) transferModalSubtitle.textContent = `Envelope: «${goal.title}» (Saldo atual: ${formatCurrency(goal.currentAmount)})`;
        if (transferAmountInput) transferAmountInput.value = '';

        setTransferType(initialType);
        if (envelopeTransferModal) envelopeTransferModal.classList.add('active');
    };

    const closeTransferModal = () => {
        if (envelopeTransferModal) envelopeTransferModal.classList.remove('active');
    };

    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        const goalId = transferEnvelopeIdInput ? transferEnvelopeIdInput.value : '';
        const goal = savingsGoals.find(g => String(g.id) === String(goalId));
        if (!goal) return;

        const amount = transferAmountInput ? parseFloat(transferAmountInput.value) : 0;
        const type = transferTypeVal ? transferTypeVal.value : 'deposit';

        if (!amount || amount <= 0) {
            showToast('Introduza um valor válido', 'info');
            return;
        }

        const todayStr = getLocalDateString(new Date());

        if (type === 'deposit') {
            goal.currentAmount = (parseFloat(goal.currentAmount) || 0) + amount;

            // Record deposit as savings transfer so it doesn't inflate consumer expense statistics
            transactions.unshift({
                id: Date.now().toString(),
                amount: amount,
                type: 'savings',
                description: `Depósito envelope: ${goal.title}`,
                category: 'Envelopes',
                date: todayStr
            });

            showToast(`Depositado «${goal.title}» de ${formatCurrency(amount)}`, 'success');
        } else {
            const current = parseFloat(goal.currentAmount) || 0;
            let actualAmount = amount;

            if (amount > current) {
                if (current <= 0) {
                    showToast('Envelope vazio', 'info');
                    return;
                }
                const confirmed = await showConfirm(
                    'Excedente de saldo',
                    `O envelope tem apenas ${formatCurrency(current)}. Levantar todo o valor disponível?`,
                    'Levantar tudo',
                    'Cancelar'
                );
                if (!confirmed) return;
                actualAmount = current;
                goal.currentAmount = 0;
            } else {
                goal.currentAmount = current - amount;
            }

            // Record withdrawal as negative savings transfer (returning money to free balance)
            transactions.unshift({
                id: Date.now().toString(),
                amount: -actualAmount,
                type: 'savings',
                description: `Levantamento envelope: ${goal.title}`,
                category: 'Envelopes',
                date: todayStr
            });

            showToast(`Levantado ${formatCurrency(actualAmount)} de «${goal.title}»`, 'info');
        }

        syncData();
        renderAll();
        closeTransferModal();
    };

    const attachEnvelopeEventListeners = () => {
        const grid = document.getElementById('envelopes-grid');
        if (!grid) return;

        if (!grid.dataset.listenerAttached) {
            grid.dataset.listenerAttached = 'true';
            grid.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const goalId = btn.dataset.id;
                if (!goalId) return;

                if (btn.classList.contains('btn-edit-envelope')) {
                    e.stopPropagation();
                    openEnvelopeModal(goalId);
                } else if (btn.classList.contains('btn-delete-envelope')) {
                    e.stopPropagation();
                    deleteEnvelope(goalId);
                } else if (btn.classList.contains('btn-deposit-envelope')) {
                    e.stopPropagation();
                    openTransferModal(goalId, 'deposit');
                } else if (btn.classList.contains('btn-withdraw-envelope')) {
                    e.stopPropagation();
                    openTransferModal(goalId, 'withdraw');
                }
            });
        }
    };

    const renderSavingsGoals = () => {
        const grid = document.getElementById('envelopes-grid');
        const dbMiniList = document.getElementById('db-envelopes-mini-list');
        const summaryCards = document.getElementById('savings-summary-cards');
        const envelopesSection = document.getElementById('savings-envelopes-section');
        const historySection = document.getElementById('savings-history-section');

        if (!grid && !dbMiniList) return;

        const hasGoals = Boolean(savingsGoals && savingsGoals.length > 0);

        if (summaryCards) {
            summaryCards.style.display = hasGoals ? '' : 'none';
        }
        if (envelopesSection) {
            envelopesSection.style.display = hasGoals ? '' : 'none';
        }
        if (historySection) {
            historySection.style.display = '';
        }

        if (grid) grid.innerHTML = '';
        if (dbMiniList) dbMiniList.innerHTML = '';

        if (!hasGoals) {
            if (dbMiniList) {
                dbMiniList.innerHTML = `
                    <div class="p-3 text-center bg-[#161619] rounded-xl border border-dashed border-[#202024]">
                        <p class="text-[11px] text-brand-textSecondary">Sem envelopes ativos</p>
                    </div>
                `;
            }
            return;
        }

        savingsGoals.forEach(goal => {
            const target = parseFloat(goal.targetAmount) || 1;
            const current = parseFloat(goal.currentAmount) || 0;
            const pct = Math.min(Math.round((current / target) * 100), 100);
            const color = goal.color || '#20a034';
            const icon = goal.icon || 'savings';

            // Render main grid card
            if (grid) {
                const card = document.createElement('div');
                card.className = 'bg-[#161619] border border-[#202024] hover:border-[#20a034]/40 rounded-2xl p-4 transition-all flex flex-col justify-between group relative overflow-hidden shadow-md';

                card.innerHTML = `
                    <div>
                        <div class="flex items-start justify-between gap-2 mb-2.5">
                            <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                                <div class="envelope-icon-box w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0" style="background-color: ${color}">
                                    <span class="material-symbols-outlined text-[20px]">${icon}</span>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <h4 class="font-semibold text-xs sm:text-sm text-white group-hover:text-[#20a034] transition-colors line-clamp-2 break-words leading-snug" title="${escapeHtml(goal.title)}">${escapeHtml(goal.title)}</h4>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                                <button type="button" class="btn-edit-envelope p-1 rounded-lg text-brand-textSecondary hover:text-white hover:bg-[#202024] transition-colors" data-id="${goal.id}" title="Editar">
                                    <span class="material-symbols-outlined text-[15px]">edit</span>
                                </button>
                                <button type="button" class="btn-delete-envelope p-1 rounded-lg text-brand-textSecondary hover:text-red-400 hover:bg-[#202024] transition-colors" data-id="${goal.id}" title="Eliminar">
                                    <span class="material-symbols-outlined text-[15px]">delete</span>
                                </button>
                            </div>
                        </div>

                        <div class="space-y-2 mt-2">
                            <div class="flex justify-between items-baseline text-xs">
                                <span class="text-brand-textSecondary text-[11px]">Acumulado</span>
                                <span class="text-white font-bold font-outfit text-xs sm:text-sm">${formatCurrency(current)} / <span class="text-brand-textSecondary text-[11px]">${formatCurrency(target)}</span></span>
                            </div>

                            <div class="progress-track bg-black h-1.5 w-full rounded-full border border-[#202024] overflow-hidden">
                                <div class="progress-thumb h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${color}"></div>
                            </div>

                            <div class="flex justify-between items-center text-[10px] text-brand-textSecondary pt-0.5">
                                <span class="font-bold px-2.5 py-0.5 rounded-full bg-brand-accentDim text-brand-accent border border-brand-accent/20 text-[10px] envelope-badge-chip">${pct}% acumulado</span>
                                <span class="text-[10px]">Restante: <strong class="text-white">${formatCurrency(Math.max(0, target - current))}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#202024]/60">
                        <button type="button" class="btn-deposit-envelope py-1.5 bg-[#20a034] hover:bg-[#20a034]/90 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition-all active:scale-95" data-id="${goal.id}">
                            <span class="material-symbols-outlined text-[14px]">add_circle</span>
                            <span>Depositar</span>
                        </button>
                        <button type="button" class="btn-withdraw-envelope py-1.5 bg-[#111113] border border-[#202024] hover:bg-[#202024] text-brand-textSecondary hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition-all active:scale-95" data-id="${goal.id}">
                            <span class="material-symbols-outlined text-[14px]">remove_circle</span>
                            <span>Levantar</span>
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            }

            // Render dashboard mini items
            if (dbMiniList) {
                const miniItem = document.createElement('div');
                miniItem.className = 'flex items-center justify-between p-2 rounded-xl bg-[#161619] border border-[#202024] hover:border-[#20a034]/30 transition-all text-xs';
                miniItem.innerHTML = `
                    <div class="flex items-center gap-2 overflow-hidden min-w-0 flex-1 pr-2">
                        <div class="envelope-icon-box w-6 h-6 rounded-lg flex items-center justify-center text-white text-[12px] flex-shrink-0" style="background-color: ${color}">
                            <span class="material-symbols-outlined text-[14px]">${icon}</span>
                        </div>
                        <span class="text-white font-medium truncate min-w-0 flex-1" title="${escapeHtml(goal.title)}">${escapeHtml(goal.title)}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="text-white font-semibold font-outfit text-xs">${formatCurrency(current)}</span>
                        <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-accentDim text-brand-accent border border-brand-accent/20 envelope-badge-chip">${pct}%</span>
                    </div>
                `;
                dbMiniList.appendChild(miniItem);
            }
        });

        attachEnvelopeEventListeners();
    };

    // Admin: load users list
    window.loadAdminUsers = async function () {
        const listEl = document.getElementById('admin-users-list');
        if (!listEl) return;
        try {
            const res = await fetch(getApiUrl('api/admin/users'), { credentials: 'same-origin' });
            const data = await res.json();
            if (!res.ok) { listEl.innerHTML = `<p class="text-xs text-red-400">${data.message}</p>`; return; }
            listEl.innerHTML = '';
            (data.users || []).forEach(u => {
                const displayName = u.name || u.email || u.username || 'Utilizador #' + u.id;
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between bg-[#0A0A0C] border border-[#202024] rounded-xl px-3 py-2';
                div.innerHTML = '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[16px] text-brand-textSecondary">person</span><span class="text-xs text-white">' + displayName + '</span><span class="text-[9px] px-1.5 py-0.5 rounded-full ' + (u.role === 'admin' ? 'bg-brand-accentDim text-brand-accent' : 'bg-[#202024] text-brand-textSecondary') + '">' + (u.role || 'user') + '</span></div><div class="flex gap-1"><button class="adm-role-btn text-[9px] px-2 py-1 rounded-lg bg-[#202024] text-brand-textSecondary hover:text-white" data-id="' + u.id + '" data-role="' + u.role + '">' + (u.role === 'admin' ? 'Rebaixar' : 'Promover') + '</button><button class="adm-del-btn text-[9px] px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50" data-id="' + u.id + '">Eliminar</button></div>';
                listEl.appendChild(div);
            });
            listEl.querySelectorAll('.adm-role-btn').forEach(btn => {
                btn.onclick = async () => {
                    await fetch(getApiUrl('api/admin/user/' + btn.dataset.id + '/role'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ role: btn.dataset.role === 'admin' ? 'user' : 'admin' }) });
                    loadAdminUsers();
                };
            });
            listEl.querySelectorAll('.adm-del-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Eliminar este utilizador?')) return;
                    await fetch(getApiUrl('api/admin/user/' + btn.dataset.id), { method: 'DELETE', credentials: 'same-origin' });
                    loadAdminUsers();
                };
            });
        } catch (e) { listEl.innerHTML = '<p class="text-xs text-red-400">Erro ao carregar</p>'; }
    };

    // Admin: create user form
    const adminCreateForm = document.getElementById('admin-create-user-form');
    if (adminCreateForm) adminCreateForm.addEventListener('submit', async e => {
        e.preventDefault();
        const username = document.getElementById('admin-new-username').value.trim();
        const password = document.getElementById('admin-new-password').value;
        if (!username || !password) return;
        try {
            const res = await fetch(getApiUrl('api/admin/user'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ username, password }) });
            const data = await res.json();
            showToast(data.message || 'Feito', res.ok ? 'success' : 'error');
            if (res.ok) { document.getElementById('admin-new-username').value = ''; document.getElementById('admin-new-password').value = ''; loadAdminUsers(); }
        } catch { showToast('Erro ao criar', 'error'); }
    });

    // Admin tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.admin-tab-btn').forEach(b => { b.classList.remove('bg-[#202024]', 'text-white'); b.classList.add('text-brand-textSecondary'); });
            btn.classList.add('bg-[#202024]', 'text-white'); btn.classList.remove('text-brand-textSecondary');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
            const pane = document.getElementById('admin-tab-' + tab);
            if (pane) pane.classList.remove('hidden');
            if (tab === 'users') loadAdminUsers();
            if (tab === 'plans') loadAdminPlans();
            if (tab === 'ads') loadAdminAds();
        });
    });

    window.loadAdminPlans = async function () {
        const listEl = document.getElementById('admin-plans-list');
        if (!listEl) return;
        try {
            const res = await fetch(getApiUrl('api/admin/plans'), { credentials: 'same-origin' });
            const data = await res.json();
            if (!res.ok) { listEl.innerHTML = `<p class="text-xs text-red-400">${data.message}</p>`; return; }
            listEl.innerHTML = '';
            data.plans.forEach(p => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between bg-[#0A0A0C] border border-[#202024] rounded-xl px-3 py-2';
                div.innerHTML = `<div class="min-w-0"><p class="text-xs text-white font-semibold truncate">${escapeHtml(p.name)} <span class="text-brand-textSecondary font-normal">${p.price !== undefined ? Number(p.price).toFixed(2) + ' €' : ''}</span></p><p class="text-[10px] text-brand-textSecondary truncate">${escapeHtml(p.stripe_price_id || '')}</p></div><div class="flex gap-1 flex-shrink-0"><button class="adm-edit-plan text-[9px] px-2 py-1 rounded-lg bg-[#202024] text-brand-textSecondary hover:text-white" data-id="${p.id}">Editar</button><button class="adm-del-plan text-[9px] px-2 py-1 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50" data-id="${p.id}">Eliminar</button></div>`;
                listEl.appendChild(div);
            });
            listEl.querySelectorAll('.adm-edit-plan').forEach(btn => {
                btn.onclick = async () => {
                    const res = await fetch(getApiUrl('api/admin/plans/' + btn.dataset.id), { credentials: 'same-origin' });
                    const p = await res.json();
                    if (!res.ok) return;
                    document.getElementById('admin-plan-id').value = p.id;
                    document.getElementById('admin-plan-name').value = p.name || '';
                    document.getElementById('admin-plan-price').value = p.price || '';
                    document.getElementById('admin-plan-stripe-price').value = p.stripe_price_id || '';
                    document.getElementById('admin-plan-description').value = p.description || '';
                    document.getElementById('admin-plan-features').value = Array.isArray(p.features) ? p.features.join('\n') : '';
                    document.getElementById('admin-plan-popular').checked = !!p.popular;
                    document.getElementById('admin-plan-active').checked = p.active !== false;
                    document.getElementById('admin-plan-sort').value = p.sort_order || '';
                };
            });
            listEl.querySelectorAll('.adm-del-plan').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Eliminar este plano?')) return;
                    await fetch(getApiUrl('api/admin/plans/' + btn.dataset.id), { method: 'DELETE', credentials: 'same-origin' });
                    loadAdminPlans();
                };
            });
        } catch (e) { listEl.innerHTML = '<p class="text-xs text-red-400">Erro ao carregar planos</p>'; }
    };

    const adminPlanForm = document.getElementById('admin-plan-form');
    if (adminPlanForm) adminPlanForm.addEventListener('submit', async e => {
        e.preventDefault();
        const payload = {
            id: document.getElementById('admin-plan-id').value || undefined,
            name: document.getElementById('admin-plan-name').value.trim(),
            price: parseFloat(document.getElementById('admin-plan-price').value) || 0,
            stripe_price_id: document.getElementById('admin-plan-stripe-price').value.trim(),
            description: document.getElementById('admin-plan-description').value.trim(),
            features: document.getElementById('admin-plan-features').value.split('\n').map(x => x.trim()).filter(Boolean),
            popular: document.getElementById('admin-plan-popular').checked,
            active: document.getElementById('admin-plan-active').checked,
            sort_order: parseInt(document.getElementById('admin-plan-sort').value) || 0
        };
        try {
            const endpoint = payload.id ? 'api/admin/plans/' + encodeURIComponent(payload.id) : 'api/admin/plans';
            const res = await fetch(getApiUrl(endpoint), { method: payload.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
            const data = await res.json();
            showToast(data.message || 'Plano guardado', res.ok ? 'success' : 'error');
            if (res.ok) { adminPlanForm.reset(); document.getElementById('admin-plan-id').value = ''; loadAdminPlans(); }
        } catch { showToast('Erro ao guardar plano', 'error'); }
    });

    window.loadAdminAds = async function () {
        const slot = document.getElementById('admin-ad-slot').value;
        try {
            const res = await fetch(getApiUrl('api/admin/ads/' + slot), { credentials: 'same-origin' });
            const data = await res.json();
            document.getElementById('admin-ad-html').value = data.html || '';
            document.getElementById('admin-ad-active').checked = data.active !== false;
        } catch { showToast('Erro ao carregar publicidade', 'error'); }
    };

    document.querySelectorAll('.ad-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ad-slot-btn').forEach(b => { b.classList.remove('bg-[#202024]', 'text-white'); b.classList.add('text-brand-textSecondary'); });
            btn.classList.add('bg-[#202024]', 'text-white'); btn.classList.remove('text-brand-textSecondary');
            document.getElementById('admin-ad-slot').value = btn.dataset.slot;
            loadAdminAds();
        });
    });

    const adminAdsForm = document.getElementById('admin-ads-form');
    if (adminAdsForm) adminAdsForm.addEventListener('submit', async e => {
        e.preventDefault();
        const payload = {
            slot_name: document.getElementById('admin-ad-slot').value,
            html: document.getElementById('admin-ad-html').value,
            active: document.getElementById('admin-ad-active').checked
        };
        try {
            const res = await fetch(getApiUrl('api/admin/ads'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
            const data = await res.json();
            showToast(data.message || 'Publicidade guardada', res.ok ? 'success' : 'error');
        } catch { showToast('Erro ao guardar publicidade', 'error'); }
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                reg.update();

                // Auto-refresh only once when a new service worker is waiting and user confirms (or after a short timeout)
                let refreshedThisSession = false;
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller && !refreshedThisSession) {
                            refreshedThisSession = true;
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            }).catch(err => {
                console.log('ServiceWorker registration skipped:', err);
            });

            // Auto-refresh when a new Service Worker takes control (guard against loops)
            let refreshing = false;
            let lastRefresh = sessionStorage.getItem('sw_last_refresh') || 0;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                const now = Date.now();
                if (!refreshing && (now - lastRefresh > 5000)) {
                    refreshing = true;
                    sessionStorage.setItem('sw_last_refresh', now);
                    window.location.reload();
                }
            });
        });
    }

    // Run Initialization
    init();
});

