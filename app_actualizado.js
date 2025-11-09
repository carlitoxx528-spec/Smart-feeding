// Estado global de la aplicación
        const AppState = {
            currentUser: null,
            currentPage: 'home',
            pets: [],
            isLoggedIn: false,
            currentQuizResult: null
        };

        // Base de datos simulada
        const Database = {
            users: JSON.parse(localStorage.getItem('smartFeeding_users')) || [],
            pets: JSON.parse(localStorage.getItem('smartFeeding_pets')) || [],
            sessions: JSON.parse(localStorage.getItem('smartFeeding_sessions')) || [],
            quizResults: JSON.parse(localStorage.getItem('smartFeeding_quizResults')) || [],
            communityPosts: JSON.parse(localStorage.getItem('smartFeeding_communityPosts')) || []
        };

        // Guardar en localStorage
        const saveToStorage = () => {
            localStorage.setItem('smartFeeding_users', JSON.stringify(Database.users));
            localStorage.setItem('smartFeeding_pets', JSON.stringify(Database.pets));
            localStorage.setItem('smartFeeding_sessions', JSON.stringify(Database.sessions));
            localStorage.setItem('smartFeeding_quizResults', JSON.stringify(Database.quizResults));
            localStorage.setItem('smartFeeding_communityPosts', JSON.stringify(Database.communityPosts));
        };

        // Utilidades
        const Utils = {
            // Generar ID único
            generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),

            // Formatear fecha
            formatDate: (date) => new Date(date).toLocaleDateString('es-ES'),

            // Validar email
            isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

            // Mostrar notificación
            showNotification: (message, type = 'info') => {
                const notification = document.createElement('div');
                notification.className = `notification notification-${type}`;
                notification.innerHTML = `
                    <div class="notification-content">
                        <span>${message}</span>
                        <button onclick="this.parentElement.parentElement.remove()">&times;</button>
                    </div>
                `;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 5000);
            }
        };

        // Módulo de Autenticación
        const AuthModule = {
            // Registrar nuevo usuario
            register: (userData) => {
                return new Promise((resolve, reject) => {
                    // Validaciones
                    if (!userData.email || !userData.password || !userData.fullName) {
                        reject('Todos los campos son obligatorios');
                        return;
                    }

                    if (!Utils.isValidEmail(userData.email)) {
                        reject('Email no válido');
                        return;
                    }

                    if (userData.password.length < 6) {
                        reject('La contraseña debe tener al menos 6 caracteres');
                        return;
                    }

                    // Verificar si el usuario ya existe
                    const existingUser = Database.users.find(u => u.email === userData.email);
                    if (existingUser) {
                        reject('El email ya está registrado');
                        return;
                    }

                    // Crear nuevo usuario
                    const newUser = {
                        id: Utils.generateId(),
                        ...userData,
                        role: 'user',
                        createdAt: new Date().toISOString(),
                        pets: []
                    };

                    Database.users.push(newUser);
                    saveToStorage();

                    // Iniciar sesión automáticamente
                    AuthModule.login(userData.email, userData.password)
                        .then(resolve)
                        .catch(reject);
                });
            },

            // Iniciar sesión
            login: (email, password) => {
                return new Promise((resolve, reject) => {
                    const user = Database.users.find(u => u.email === email && u.password === password);
                    
                    if (!user) {
                        reject('Email o contraseña incorrectos');
                        return;
                    }

                    // Crear sesión
                    const session = {
                        id: Utils.generateId(),
                        userId: user.id,
                        createdAt: new Date().toISOString()
                    };

                    Database.sessions.push(session);
                    saveToStorage();

                    AppState.currentUser = user;
                    AppState.isLoggedIn = true;

                    // Cargar mascotas del usuario
                    AppState.pets = Database.pets.filter(pet => pet.ownerId === user.id);

                    resolve(user);
                });
            },

            // Cerrar sesión
            logout: () => {
                AppState.currentUser = null;
                AppState.isLoggedIn = false;
                AppState.pets = [];
                Router.navigate('/');
            },

            // Verificar sesión activa
            checkAuth: () => {
                const lastSession = Database.sessions[Database.sessions.length - 1];
                if (lastSession) {
                    const user = Database.users.find(u => u.id === lastSession.userId);
                    if (user) {
                        AppState.currentUser = user;
                        AppState.isLoggedIn = true;
                        // Cargar mascotas del usuario
                        AppState.pets = Database.pets.filter(pet => pet.ownerId === user.id);
                    }
                }
            }
        };

        // Módulo de Enrutamiento
        const Router = {
            routes: {
                '/': 'home',
                '/login': 'login',
                '/register': 'register',
                '/dashboard': 'dashboard',
                '/pets': 'pets',
                '/quiz': 'quiz',
                '/recommendations': 'recommendations',
                '/stats': 'stats',
                '/community': 'community',
                '/admin': 'admin'
            },

            navigate: (path) => {
                const route = Router.routes[path] || 'home';
                AppState.currentPage = route;
                RenderModule.renderPage(route);
                window.history.pushState({}, '', path);
            },

            init: () => {
                // Manejar navegación con el botón atrás/adelante
                window.addEventListener('popstate', () => {
                    const path = window.location.pathname;
                    Router.navigate(path);
                });

                // Navegación inicial
                const initialPath = window.location.pathname || '/';
                Router.navigate(initialPath);
            }
        };

        // Módulo de Gestión de Mascotas
        const PetsModule = {
            // Agregar nueva mascota
            addPet: (petData) => {
                return new Promise((resolve, reject) => {
                    if (!petData.name || !petData.type || !petData.breed) {
                        reject('Nombre, tipo y raza son obligatorios');
                        return;
                    }

                    const newPet = {
                        id: Utils.generateId(),
                        ownerId: AppState.currentUser.id,
                        ...petData,
                        createdAt: new Date().toISOString(),
                        hasRecommendations: false,
                        lastFeeding: null,
                        weightHistory: [],
                        feedingHistory: [],
                        expenseHistory: [],
                        medicalNotes: []
                    };

                    Database.pets.push(newPet);
                    AppState.pets.push(newPet);
                    saveToStorage();

                    Utils.showNotification('Mascota agregada exitosamente', 'success');
                    resolve(newPet);
                });
            },

            // Editar mascota
            updatePet: (petId, updates) => {
                const petIndex = Database.pets.findIndex(p => p.id === petId);
                if (petIndex === -1) {
                    throw new Error('Mascota no encontrada');
                }

                Database.pets[petIndex] = { ...Database.pets[petIndex], ...updates };
                
                // Actualizar en el estado
                const stateIndex = AppState.pets.findIndex(p => p.id === petId);
                if (stateIndex !== -1) {
                    AppState.pets[stateIndex] = Database.pets[petIndex];
                }

                saveToStorage();
                Utils.showNotification('Mascota actualizada', 'success');
            },

            // Eliminar mascota
            deletePet: (petId) => {
                Database.pets = Database.pets.filter(p => p.id !== petId);
                AppState.pets = AppState.pets.filter(p => p.id !== petId);
                saveToStorage();
                Utils.showNotification('Mascota eliminada', 'success');
            },

            // Agregar registro de peso
            addWeightRecord: (petId, weight, date = new Date()) => {
                const pet = Database.pets.find(p => p.id === petId);
                if (!pet) return;

                pet.weightHistory.push({
                    weight: parseFloat(weight),
                    date: date.toISOString(),
                    recordedAt: new Date().toISOString()
                });

                // Ordenar por fecha
                pet.weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
                saveToStorage();
            },

            // Registrar gasto o consumo de alimento
addExpenseRecord: (petId, type, amount, date = new Date()) => {
    const pet = Database.pets.find(p => p.id === petId);
    if (!pet) return;

    if (!pet.expenseHistory) pet.expenseHistory = [];

    pet.expenseHistory.push({
        id: Utils.generateId(),
        type, // "comida", "veterinario", etc.
        amount: parseFloat(amount),
        date: date.toISOString()
    });

    saveToStorage();
    Utils.showNotification('Gasto registrado', 'success');
},

// Obtener estadísticas del perro
getStats: (petId) => {
    const pet = Database.pets.find(p => p.id === petId);
    if (!pet) return null;

    const weightHistory = pet.weightHistory || [];
    const expenses = pet.expenseHistory || [];

    const avgWeight = weightHistory.reduce((a, w) => a + w.weight, 0) / (weightHistory.length || 1);
    const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);

    return {
        avgWeight: avgWeight.toFixed(1),
        totalExpenses: totalExpenses.toFixed(2),
        lastUpdate: weightHistory.length ? Utils.formatDate(weightHistory.at(-1).date) : 'Sin registros'
    };
},

            // Registrar evento de alimentación (consumo)
            addFeedingRecord: (petId, grams, date = new Date(), foodType = 'comida') => {
                const pet = Database.pets.find(p => p.id === petId);
                if (!pet) return;

                if (!pet.feedingHistory) pet.feedingHistory = [];

                pet.feedingHistory.push({
                    id: Utils.generateId(),
                    grams: parseFloat(grams),
                    foodType,
                    date: date.toISOString()
                });

                saveToStorage();
                Utils.showNotification('Alimentación registrada', 'success');
            },

            // Agregar nota médica
            addMedicalNote: (petId, note) => {
                const pet = Database.pets.find(p => p.id === petId);
                if (!pet) return;

                pet.medicalNotes.push({
                    id: Utils.generateId(),
                    note: note,
                    createdAt: new Date().toISOString(),
                    createdBy: AppState.currentUser.id
                });

                saveToStorage();
                Utils.showNotification('Nota médica agregada', 'success');
            },

            // Obtener mascota por ID
            getPetById: (petId) => {
                return Database.pets.find(p => p.id === petId);
            },

            // Obtener todas las mascotas del usuario
            getUserPets: () => {
                return Database.pets.filter(p => p.ownerId === AppState.currentUser.id);
            },

            // Métodos de UI para mascotas
            showAddPetModal: () => {
                document.getElementById('petModalTitle').textContent = 'Agregar Mascota';
                document.getElementById('petForm').reset();
                document.getElementById('petForm').dataset.mode = 'add';
                document.getElementById('petModal').classList.remove('hidden');
                PetsModule.updateBreeds();
            },

            showEditPetModal: (petId) => {
                const pet = PetsModule.getPetById(petId);
                if (!pet) return;

                document.getElementById('petModalTitle').textContent = 'Editar Mascota';
                document.getElementById('petName').value = pet.name;
                document.getElementById('petType').value = pet.type;
                PetsModule.updateBreeds();
                setTimeout(() => {
                    document.getElementById('petBreed').value = pet.breed;
                    document.getElementById('petAge').value = pet.age || '';
                    document.getElementById('petWeight').value = pet.weight || '';
                    document.getElementById('petConditions').value = pet.specialConditions || '';
                }, 100);
                
                document.getElementById('petForm').dataset.mode = 'edit';
                document.getElementById('petForm').dataset.petId = petId;
                document.getElementById('petModal').classList.remove('hidden');
            },

            hidePetModal: () => {
                document.getElementById('petModal').classList.add('hidden');
            },

            updateBreeds: () => {
                const type = document.getElementById('petType').value;
                const breedSelect = document.getElementById('petBreed');
                
                breedSelect.innerHTML = '<option value="">Seleccionar raza</option>';
                
                if (type === 'perro') {
                    const dogBreeds = ['Labrador Retriever', 'Pastor Alemán', 'Golden Retriever', 'Bulldog Francés', 'Beagle', 'Chihuahua', 'Poodle', 'Rottweiler', 'Yorkshire Terrier', 'Boxer', 'Otra raza'];
                    dogBreeds.forEach(breed => {
                        breedSelect.innerHTML += `<option value="${breed}">${breed}</option>`;
                    });
                } else if (type === 'gato') {
                    const catBreeds = ['Siamés', 'Persa', 'Maine Coon', 'Bengalí', 'Ragdoll', 'Esfinge', 'British Shorthair', 'Scottish Fold', 'Angora Turco', 'Otra raza'];
                    catBreeds.forEach(breed => {
                        breedSelect.innerHTML += `<option value="${breed}">${breed}</option>`;
                    });
                }
            },

            handlePetFormSubmit: (e) => {
                e.preventDefault();
                
                const formData = {
                    name: document.getElementById('petName').value,
                    type: document.getElementById('petType').value,
                    breed: document.getElementById('petBreed').value,
                    age: document.getElementById('petAge').value || null,
                    weight: document.getElementById('petWeight').value || null,
                    specialConditions: document.getElementById('petConditions').value || null
                };

                const mode = e.target.dataset.mode;

                if (mode === 'add') {
                    PetsModule.addPet(formData)
                        .then(() => {
                            PetsModule.hidePetModal();
                            Router.navigate('/pets');
                        })
                        .catch(error => Utils.showNotification(error, 'error'));
                } else if (mode === 'edit') {
                    const petId = e.target.dataset.petId;
                    PetsModule.updatePet(petId, formData);
                    PetsModule.hidePetModal();
                    Router.navigate('/pets');
                }
            },

            showPetDetail: (petId) => {
                const pet = PetsModule.getPetById(petId);
                if (!pet) return;

                document.getElementById('petDetailTitle').textContent = pet.name;
                document.getElementById('petDetailContent').innerHTML = `
                    <div class="pet-detail">
                        <div class="detail-section">
                            <h4>Información Básica</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Tipo:</label>
                                    <span>${pet.type === 'perro' ? 'Perro' : 'Gato'}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Raza:</label>
                                    <span>${pet.breed}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Edad:</label>
                                    <span>${pet.age ? pet.age + ' años' : 'No especificada'}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Peso:</label>
                                    <span>${pet.weight ? pet.weight + ' kg' : 'No especificado'}</span>
                                </div>
                            </div>
                        </div>

                        ${pet.specialConditions ? `
                            <div class="detail-section">
                                <h4>Condiciones Especiales</h4>
                                <p>${pet.specialConditions}</p>
                            </div>
                        ` : ''}

                        <div class="detail-actions">
                            <button class="btn btn-accent" onclick="Router.navigate('/quiz?petId=${pet.id}')">
                                <i class="fas fa-clipboard-list"></i> Realizar Cuestionario
                            </button>
                            <button class="btn btn-secondary" onclick="PetsModule.showWeightModal('${pet.id}')">
                                <i class="fas fa-weight"></i> Registrar Peso
                            </button>
                            <button class="btn btn-secondary" onclick="PetsModule.showExpenseModal('${pet.id}')">
                                <i class="fas fa-wallet"></i> Registrar Gasto
                            </button>
                            <button class="btn btn-secondary" onclick="PetsModule.showFeedingModal('${pet.id}')">
                                <i class="fas fa-bowl-food"></i> Registrar Alimentación
                            </button>
                            <button class="btn btn-secondary" onclick="PetsModule.showMedicalNoteModal('${pet.id}')">
                                <i class="fas fa-notes-medical"></i> Agregar Nota
                            </button>
                        </div>
                        <div class="card">
                            <h2>Alimentacion (${period})</h2>
                            <div class="table-responsive">
                                <table class="stats-table">
                                    <thead><tr><th>Periodo</th><th>Gramos</th></tr></thead>
                                    <tbody>
                                        ${agg.feedings.map(r=>`<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById('petDetailModal').classList.remove('hidden');
            },

            hidePetDetailModal: () => {
                document.getElementById('petDetailModal').classList.add('hidden');
            },

            // UI: Registrar Peso
            showWeightModal: (petId) => {
                const modal = document.getElementById('weightModal');
                if (!modal) return;
                modal.classList.remove('hidden');
                const form = document.getElementById('weightForm');
                form.dataset.petId = petId;
                // Default date today
                const d = new Date();
                document.getElementById('weightDate').value = d.toISOString().slice(0,10);
                document.getElementById('weightValue').value = '';
            },
            hideWeightModal: () => {
                const modal = document.getElementById('weightModal');
                if (modal) modal.classList.add('hidden');
            },
            handleWeightFormSubmit: (e) => {
                e.preventDefault();
                const petId = e.target.dataset.petId;
                const weight = parseFloat(document.getElementById('weightValue').value);
                const dateStr = document.getElementById('weightDate').value;
                const date = dateStr ? new Date(dateStr) : new Date();
                if (!petId || isNaN(weight)) {
                    Utils.showNotification('Datos de peso inválidos', 'error');
                    return false;
                }
                PetsModule.addWeightRecord(petId, weight, date);
                Utils.showNotification('Peso registrado', 'success');
                PetsModule.hideWeightModal();
                return false;
            },

            // UI: Registrar Gasto
            showExpenseModal: (petId) => {
                const modal = document.getElementById('expenseModal');
                if (!modal) return;
                modal.classList.remove('hidden');
                const form = document.getElementById('expenseForm');
                form.dataset.petId = petId;
                const d = new Date();
                document.getElementById('expenseDate').value = d.toISOString().slice(0,10);
                document.getElementById('expenseAmount').value = '';
                document.getElementById('expenseType').value = 'comida';
            },
            hideExpenseModal: () => {
                const modal = document.getElementById('expenseModal');
                if (modal) modal.classList.add('hidden');
            },
            handleExpenseFormSubmit: (e) => {
                e.preventDefault();
                const petId = e.target.dataset.petId;
                const type = document.getElementById('expenseType').value || 'otros';
                const amount = parseFloat(document.getElementById('expenseAmount').value);
                const dateStr = document.getElementById('expenseDate').value;
                const date = dateStr ? new Date(dateStr) : new Date();
                if (!petId || isNaN(amount)) {
                    Utils.showNotification('Datos de gasto inválidos', 'error');
                    return false;
                }
                PetsModule.addExpenseRecord(petId, type, amount, date);
                PetsModule.hideExpenseModal();
                return false;
            },

            // UI: Registrar Alimentación
            showFeedingModal: (petId) => {
                const modal = document.getElementById('feedingModal');
                if (!modal) return;
                modal.classList.remove('hidden');
                const form = document.getElementById('feedingForm');
                form.dataset.petId = petId;
                const d = new Date();
                document.getElementById('feedingDate').value = d.toISOString().slice(0,10);
                document.getElementById('feedingGrams').value = '';
                const typeSel = document.getElementById('feedingType');
                if (typeSel) typeSel.value = 'comida';
            },
            hideFeedingModal: () => {
                const modal = document.getElementById('feedingModal');
                if (modal) modal.classList.add('hidden');
            },
            handleFeedingFormSubmit: (e) => {
                e.preventDefault();
                const petId = e.target.dataset.petId;
                const grams = parseFloat(document.getElementById('feedingGrams').value);
                const foodType = (document.getElementById('feedingType')?.value) || 'comida';
                const dateStr = document.getElementById('feedingDate').value;
                const date = dateStr ? new Date(dateStr) : new Date();
                if (!petId || isNaN(grams)) {
                    Utils.showNotification('Datos de alimentación inválidos', 'error');
                    return false;
                }
                PetsModule.addFeedingRecord(petId, grams, date, foodType);
                PetsModule.hideFeedingModal();
                return false;
            }
        };

        // Módulo de Cuestionario Interactivo
        const QuizModule = {
            currentStep: 1,
            totalSteps: 5,
            currentPetId: null,
            answers: {},

            // Inicializar cuestionario
            init: (petId = null) => {
                QuizModule.currentStep = 1;
                QuizModule.currentPetId = petId;
                QuizModule.answers = {
                    petId: petId,
                    activityLevel: '',
                    healthConditions: [],
                    eatingHabits: '',
                    foodType: '',
                    createdAt: new Date().toISOString()
                };
            },

            // Navegar al siguiente paso
            nextStep: () => {
                if (QuizModule.currentStep < QuizModule.totalSteps) {
                    QuizModule.currentStep++;
                    QuizModule.renderCurrentStep();
                } else {
                    QuizModule.completeQuiz();
                }
            },

            // Navegar al paso anterior
            prevStep: () => {
                if (QuizModule.currentStep > 1) {
                    QuizModule.currentStep--;
                    QuizModule.renderCurrentStep();
                }
            },

            // Guardar respuesta
            saveAnswer: (question, answer) => {
                QuizModule.answers[question] = answer;
            },

            // Completar cuestionario
            
completeQuiz: () => {
    // Generar recomendaciones basadas en las respuestas
    const recommendations = RecommendationModule.generateRecommendations(QuizModule.answers);
    
    // Guardar cuestionario completado
    const quizResult = {
        id: Utils.generateId(),
        ...QuizModule.answers,
        recommendations: recommendations,
        completedAt: new Date().toISOString()
    };

    // Guardar en la base de datos
    Database.quizResults.push(quizResult);
    saveToStorage();

    // Actualizar mascota si existe
    if (QuizModule.currentPetId) {
        const pet = PetsModule.getPetById(QuizModule.currentPetId);
        if (pet) {
            pet.hasRecommendations = true;
            pet.lastQuiz = new Date().toISOString();
            saveToStorage();
        }
    }

    // 🔹 Guardar en memoria y localStorage para conservar el resultado
    AppState.currentQuizResult = quizResult;
    localStorage.setItem('smartFeeding_lastQuizResult', JSON.stringify(quizResult));

    Utils.showNotification('¡Cuestionario completado! Generando recomendaciones...', 'success');
    
    // Redirigir a recomendaciones
    Router.navigate('/recommendations');
}
,

            // Renderizar paso actual
            renderCurrentStep: () => { // FIX: adaptativo - devuelve HTML si el contenedor no existe
                // Si el contenedor del quiz existe en el DOM, renderizamos directamente ahí.
                const stepHtml = (() => {
                    switch (QuizModule.currentStep) {
                        case 1: return QuizModule.renderStep1();
                        case 2: return QuizModule.renderStep2();
                        case 3: return QuizModule.renderStep3();
                        case 4: return QuizModule.renderStep4();
                        case 5: return QuizModule.renderStep5();
                        default: return '';
                    }
                })();

                const quizContainer = document.getElementById('quizContainer');
                if (!quizContainer) {
                    // Si no existe el contenedor aún (se está construyendo la página),
                    // devolvemos el HTML para que pueda ser inyectado en una plantilla.
                    // FIX: devolver HTML cuando el DOM no está disponible.
                    QuizModule.updateProgress(); // actualizar valores internos si aplica
                    return stepHtml;
                }

                // Si existe el contenedor, inserto el HTML directamente y actualizo progreso
                quizContainer.innerHTML = stepHtml;
                QuizModule.updateProgress();
                return '';
    
            },

            // Paso 1: Nivel de actividad
            renderStep1: () => {
                const pet = QuizModule.currentPetId ? PetsModule.getPetById(QuizModule.currentPetId) : null;
                const petName = pet ? pet.name : 'tu mascota';
                
                return `
                    <div class="quiz-step">
                        <h2>Nivel de Actividad</h2>
                        <p>¿Cómo describirías el nivel de actividad de ${petName}?</p>
                        
                        <div class="options-grid">
                            <div class="option-card ${QuizModule.answers.activityLevel === 'sedentary' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('activityLevel', 'sedentary')">
                                <i class="fas fa-couch"></i>
                                <h4>Sedentario</h4>
                                <p>Pasa la mayor parte del tiempo descansando, paseos cortos</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.activityLevel === 'moderate' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('activityLevel', 'moderate')">
                                <i class="fas fa-walking"></i>
                                <h4>Moderado</h4>
                                <p>Paseos diarios regulares, juego ocasional</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.activityLevel === 'active' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('activityLevel', 'active')">
                                <i class="fas fa-running"></i>
                                <h4>Activo</h4>
                                <p>Ejercicio diario intenso, mucho juego</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.activityLevel === 'very-active' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('activityLevel', 'very-active')">
                                <i class="fas fa-hiking"></i>
                                <h4>Muy Activo</h4>
                                <p>Atleta, entrenamiento regular, trabajo</p>
                            </div>
                        </div>
                    </div>
                `;
            },

            // Paso 2: Condiciones de salud
            renderStep2: () => {
                return `
                    <div class="quiz-step">
                        <h2>Condiciones de Salud</h2>
                        <p>Selecciona las condiciones que aplican a tu mascota:</p>
                        
                        <div class="checkbox-grid">
                            <label class="checkbox-option">
                                <input type="checkbox" value="overweight" 
                                       ${QuizModule.answers.healthConditions?.includes('overweight') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('overweight')">
                                <span>Sobrepeso</span>
                            </label>
                            
                            <label class="checkbox-option">
                                <input type="checkbox" value="allergies" 
                                       ${QuizModule.answers.healthConditions?.includes('allergies') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('allergies')">
                                <span>Alergias alimentarias</span>
                            </label>
                            
                            <label class="checkbox-option">
                                <input type="checkbox" value="digestive" 
                                       ${QuizModule.answers.healthConditions?.includes('digestive') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('digestive')">
                                <span>Sensibilidad digestiva</span>
                            </label>
                            
                            <label class="checkbox-option">
                                <input type="checkbox" value="joint" 
                                       ${QuizModule.answers.healthConditions?.includes('joint') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('joint')">
                                <span>Problemas articulares</span>
                            </label>
                            
                            <label class="checkbox-option">
                                <input type="checkbox" value="dental" 
                                       ${QuizModule.answers.healthConditions?.includes('dental') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('dental')">
                                <span>Problemas dentales</span>
                            </label>
                            
                            <label class="checkbox-option">
                                <input type="checkbox" value="renal" 
                                       ${QuizModule.answers.healthConditions?.includes('renal') ? 'checked' : ''}
                                       onchange="QuizModule.toggleHealthCondition('renal')">
                                <span>Problemas renales</span>
                            </label>
                        </div>
                    </div>
                `;
            },

            // Paso 3: Hábitos alimenticios
            renderStep3: () => {
                return `
                    <div class="quiz-step">
                        <h2>Hábitos Alimenticios</h2>
                        <p>¿Cómo es el apetito y comportamiento alimenticio de tu mascota?</p>
                        
                        <div class="options-grid">
                            <div class="option-card ${QuizModule.answers.eatingHabits === 'picky' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('eatingHabits', 'picky')">
                                <i class="fas fa-times-circle"></i>
                                <h4>Exigente</h4>
                                <p>Es selectivo con la comida, come poco</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.eatingHabits === 'normal' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('eatingHabits', 'normal')">
                                <i class="fas fa-check-circle"></i>
                                <h4>Normal</h4>
                                <p>Come bien sin problemas</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.eatingHabits === 'voracious' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('eatingHabits', 'voracious')">
                                <i class="fas fa-bolt"></i>
                                <h4>Voraz</h4>
                                <p>Come rápido y siempre tiene hambre</p>
                            </div>
                        </div>
                    </div>
                `;
            },

            // Paso 4: Tipo de alimento actual
            renderStep4: () => {
                return `
                    <div class="quiz-step">
                        <h2>Alimentación Actual</h2>
                        <p>¿Qué tipo de alimento consume actualmente tu mascota?</p>
                        
                        <div class="options-grid">
                            <div class="option-card ${QuizModule.answers.foodType === 'dry' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('foodType', 'dry')">
                                <i class="fas fa-cube"></i>
                                <h4>Alimento Seco</h4>
                                <p>Croquetas, pienso</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.foodType === 'wet' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('foodType', 'wet')">
                                <i class="fas fa-utensils"></i>
                                <h4>Alimento Húmedo</h4>
                                <p>Latas, sobres</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.foodType === 'mixed' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('foodType', 'mixed')">
                                <i class="fas fa-random"></i>
                                <h4>Mixto</h4>
                                <p>Combinación de seco y húmedo</p>
                            </div>
                            
                            <div class="option-card ${QuizModule.answers.foodType === 'homemade' ? 'selected' : ''}" 
                                 onclick="QuizModule.selectOption('foodType', 'homemade')">
                                <i class="fas fa-home"></i>
                                <h4>Casero</h4>
                                <p>Comida preparada en casa</p>
                            </div>
                        </div>
                    </div>
                `;
            },

            // Paso 5: Resumen y confirmación
            renderStep5: () => {
                const pet = QuizModule.currentPetId ? PetsModule.getPetById(QuizModule.currentPetId) : null;
                
                return `
                    <div class="quiz-step">
                        <h2>Resumen</h2>
                        <p>Revisa la información antes de generar las recomendaciones:</p>
                        
                        <div class="summary-card">
                            <h4>Resumen del Cuestionario</h4>
                            ${pet ? `<p><strong>Mascota:</strong> ${pet.name}</p>` : ''}
                            <p><strong>Nivel de actividad:</strong> ${QuizModule.getActivityLevelText(QuizModule.answers.activityLevel)}</p>
                            <p><strong>Condiciones de salud:</strong> ${QuizModule.answers.healthConditions?.length > 0 ? QuizModule.answers.healthConditions.join(', ') : 'Ninguna'}</p>
                            <p><strong>Hábitos alimenticios:</strong> ${QuizModule.getEatingHabitsText(QuizModule.answers.eatingHabits)}</p>
                            <p><strong>Tipo de alimento:</strong> ${QuizModule.getFoodTypeText(QuizModule.answers.foodType)}</p>
                        </div>
                        
                        <div class="quiz-note">
                            <i class="fas fa-info-circle"></i>
                            <p>Las recomendaciones se generarán basadas en esta información y podrás ajustarlas después.</p>
                        </div>
                    </div>
                `;
            },

            // Métodos auxiliares
            selectOption: (question, value) => {
                QuizModule.saveAnswer(question, value);
                QuizModule.renderCurrentStep();
            },

            toggleHealthCondition: (condition) => {
                if (!QuizModule.answers.healthConditions) {
                    QuizModule.answers.healthConditions = [];
                }
                
                const index = QuizModule.answers.healthConditions.indexOf(condition);
                if (index > -1) {
                    QuizModule.answers.healthConditions.splice(index, 1);
                } else {
                    QuizModule.answers.healthConditions.push(condition);
                }
            },

            updateProgress: () => {
                const progressBar = document.querySelector('.quiz-progress-bar');
                const progressText = document.querySelector('.quiz-progress-text');
                
                if (progressBar && progressText) {
                    const progress = (QuizModule.currentStep / QuizModule.totalSteps) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `Paso ${QuizModule.currentStep} de ${QuizModule.totalSteps}`;
                }
            },

            getActivityLevelText: (level) => {
                const levels = {
                    'sedentary': 'Sedentario',
                    'moderate': 'Moderado',
                    'active': 'Activo',
                    'very-active': 'Muy Activo'
                };
                return levels[level] || 'No especificado';
            },

            getEatingHabitsText: (habits) => {
                const habitsText = {
                    'picky': 'Exigente',
                    'normal': 'Normal',
                    'voracious': 'Voraz'
                };
                return habitsText[habits] || 'No especificado';
            },

            getFoodTypeText: (type) => {
                const types = {
                    'dry': 'Alimento Seco',
                    'wet': 'Alimento Húmedo',
                    'mixed': 'Mixto',
                    'homemade': 'Casero'
                };
                return types[type] || 'No especificado';
            }
        };

        // Módulo de Recomendaciones Inteligentes
        const RecommendationModule = {
            // Generar recomendaciones basadas en respuestas del cuestionario
            generateRecommendations: (quizAnswers) => {
                const recommendations = {
                    dietPlan: {},
                    feedingSchedule: {},
                    products: [],
                    tips: [],
                    warnings: []
                };

                // Obtener información de la mascota si existe
                const pet = quizAnswers.petId ? PetsModule.getPetById(quizAnswers.petId) : null;

                // Generar plan de dieta basado en nivel de actividad
                recommendations.dietPlan = RecommendationModule.generateDietPlan(quizAnswers, pet);

                // Generar horario de alimentación
                recommendations.feedingSchedule = RecommendationModule.generateFeedingSchedule(quizAnswers, pet);

                // Recomendar productos específicos
                recommendations.products = RecommendationModule.recommendProducts(quizAnswers, pet);

                // Generar tips personalizados
                recommendations.tips = RecommendationModule.generateTips(quizAnswers, pet);

                // Advertencias basadas en condiciones de salud
                recommendations.warnings = RecommendationModule.generateWarnings(quizAnswers, pet);

                return recommendations;
            },

            // Generar plan de dieta
            generateDietPlan: (answers, pet) => {
                const plan = {
                    type: '',
                    calories: 0,
                    protein: 0,
                    fat: 0,
                    carbs: 0,
                    description: ''
                };

                // Calcular calorías base (estimación simple)
                let baseCalories = 500; // Calorías base para mascota mediana
                
                if (pet && pet.weight) {
                    baseCalories = pet.weight * 30; // 30 calorías por kg
                }

                // Ajustar por nivel de actividad
                const activityMultipliers = {
                    'sedentary': 0.8,
                    'moderate': 1.0,
                    'active': 1.2,
                    'very-active': 1.4
                };

                const multiplier = activityMultipliers[answers.activityLevel] || 1.0;
                plan.calories = Math.round(baseCalories * multiplier);

                // Determinar tipo de dieta
                if (answers.healthConditions?.includes('overweight')) {
                    plan.type = 'Bajo en calorías';
                    plan.calories = Math.round(plan.calories * 0.8);
                } else if (answers.healthConditions?.includes('renal')) {
                    plan.type = 'Bajo en fósforo';
                } else if (answers.activityLevel === 'very-active') {
                    plan.type = 'Alto en proteína';
                } else {
                    plan.type = 'Balanceado';
                }

                // Calcular macronutrientes
                plan.protein = Math.round((plan.calories * 0.25) / 4); // 25% proteína
                plan.fat = Math.round((plan.calories * 0.15) / 9);     // 15% grasa
                plan.carbs = Math.round((plan.calories * 0.60) / 4);   // 60% carbohidratos

                plan.description = `Plan ${plan.type} de ${plan.calories} calorías diarias`;

                return plan;
            },

            // Generar horario de alimentación
            generateFeedingSchedule: (answers, pet) => {
                const schedule = {
                    frequency: 2,
                    times: [],
                    portions: []
                };

                // Determinar frecuencia basada en hábitos alimenticios
                if (answers.eatingHabits === 'voracious') {
                    schedule.frequency = 3;
                } else if (answers.eatingHabits === 'picky') {
                    schedule.frequency = 2;
                } else {
                    schedule.frequency = 2;
                }

                // Generar horarios
                if (schedule.frequency === 2) {
                    schedule.times = ['08:00', '18:00'];
                } else if (schedule.frequency === 3) {
                    schedule.times = ['08:00', '13:00', '18:00'];
                }

                // Calcular porciones
                const totalCalories = RecommendationModule.calculateDietPlan(answers, pet).calories;
                const portionCalories = Math.round(totalCalories / schedule.frequency);

                schedule.portions = Array(schedule.frequency).fill(`${portionCalories} calorías`);

                return schedule;
            },

            // Recomendar productos específicos
            recommendProducts: (answers, pet) => {
                const products = [];
                const petType = pet ? pet.type : 'perro'; // Default a perro si no hay info

                // Productos base según tipo de mascota
                const baseProducts = {
                    'perro': [
                        {
                            name: 'Royal Canin Medium Adult',
                            type: 'dry',
                            description: 'Alimento balanceado para perros adultos de raza mediana',
                            benefits: ['Pelo brillante', 'Digestión sana', 'Huesos fuertes'],
                            price: '$$'
                        },
                        {
                            name: 'Hills Science Diet Perfect Weight',
                            type: 'dry',
                            description: 'Para control de peso y mantenimiento',
                            benefits: ['Control de peso', 'Musculatura magra', 'Energía sostenida'],
                            price: '$$$'
                        }
                    ],
                    'gato': [
                        {
                            name: 'Purina Pro Plan Delicate',
                            type: 'dry',
                            description: 'Para gatos con digestión sensible',
                            benefits: ['Digestión suave', 'Pelo saludable', 'Sistema inmune'],
                            price: '$$'
                        },
                        {
                            name: 'Whiskas Wet Food Selection',
                            type: 'wet',
                            description: 'Variedad de sabores en alimento húmedo',
                            benefits: ['Hidratación', 'Sabores variados', 'Textura suave'],
                            price: '$$'
                        }
                    ]
                };

                // Agregar productos base
                products.push(...baseProducts[petType] || baseProducts['perro']);

                // Productos especializados según condiciones
                if (answers.healthConditions?.includes('allergies')) {
                    products.push({
                        name: 'Hypoallergenic Veterinary Diet',
                        type: 'dry',
                        description: 'Fórmula hipoalergénica para mascotas con alergias',
                        benefits: ['Sin alérgenos comunes', 'Piel sana', 'Digestión suave'],
                        price: '$$$$'
                    });
                }

                if (answers.healthConditions?.includes('joint')) {
                    products.push({
                        name: 'Joint Care Supplement',
                        type: 'supplement',
                        description: 'Suplemento para salud articular',
                        benefits: ['Movilidad mejorada', 'Cartílago protegido', 'Antiinflamatorio'],
                        price: '$$$'
                    });
                }

                if (answers.healthConditions?.includes('dental')) {
                    products.push({
                        name: 'Dental Health Chews',
                        type: 'treat',
                        description: 'Premios para limpieza dental',
                        benefits: ['Limpieza dental', 'Aliento fresco', 'Entretenimiento'],
                        price: '$$'
                    });
                }

                return products;
            },

            // Generar tips personalizados
            generateTips: (answers, pet) => {
                const tips = [];

                // Tips generales
                tips.push('Mantén agua fresca disponible siempre');
                tips.push('Establece horarios regulares de alimentación');

                // Tips según nivel de actividad
                if (answers.activityLevel === 'sedentary') {
                    tips.push('Considera reducir las calorías en un 10-20% para evitar sobrepeso');
                    tips.push('Incorpora juego suave diario para mantener actividad');
                } else if (answers.activityLevel === 'very-active') {
                    tips.push('Aumenta la proteína en la dieta para soportar la actividad');
                    tips.push('Considera suplementos de glucosamina para articulaciones');
                }

                // Tips según hábitos alimenticios
                if (answers.eatingHabits === 'picky') {
                    tips.push('Prueba con alimentos de diferentes texturas y sabores');
                    tips.push('Calienta ligeramente el alimento para realzar el aroma');
                } else if (answers.eatingHabits === 'voracious') {
                    tips.push('Usa platos especiales que ralenticen la comida');
                    tips.push('Divide la comida en porciones más pequeñas y frecuentes');
                }

                // Tips según condiciones de salud
                if (answers.healthConditions?.includes('overweight')) {
                    tips.push('Mide las porciones exactamente');
                    tips.push('Incorpora ejercicio gradualmente');
                    tips.push('Evita los premios altos en calorías');
                }

                if (answers.healthConditions?.includes('digestive')) {
                    tips.push('Introduce cambios de alimento gradualmente');
                    tips.push('Considera probióticos para la salud digestiva');
                }

                return tips;
            },

            // Generar advertencias
            generateWarnings: (answers, pet) => {
                const warnings = [];

                if (answers.healthConditions?.includes('renal')) {
                    warnings.push('CONSULTA AL VETERINARIO: Los problemas renales requieren supervisión profesional');
                }

                if (answers.healthConditions?.includes('overweight') && answers.activityLevel === 'sedentary') {
                    warnings.push('Vigila el peso regularmente y ajusta la dieta según sea necesario');
                }

                if (!answers.foodType || answers.foodType === 'homemade') {
                    warnings.push('Las dietas caseras deben ser balanceadas y supervisadas por un veterinario');
                }

                return warnings;
            },

            // Calcular plan de dieta (método auxiliar)
            calculateDietPlan: (answers, pet) => {
                return RecommendationModule.generateDietPlan(answers, pet);
            },

            // Métodos de UI para recomendaciones
            exportToPDF: () => {
                Utils.showNotification('Generando PDF... Esta función se implementará completamente en la versión final', 'info');
            },

            
savePlan: () => {
 let quizResult = AppState.currentQuizResult || JSON.parse(localStorage.getItem('smartFeeding_lastQuizResult'));

    if (!quizResult) {
        Utils.showNotification('No hay plan para guardar', 'error');
        return;
    }

    // 🔹 Si no hay mascota, simplemente guardar el plan sin asociarlo
    if (!quizResult.petId) {
        localStorage.setItem('smartFeeding_savedPlan', JSON.stringify(quizResult.recommendations));
        Utils.showNotification('Plan guardado localmente', 'success');
        return;
    }

    const pet = PetsModule.getPetById(quizResult.petId);
    if (!pet) {
        Utils.showNotification('Mascota no encontrada', 'error');
        return;
    }

    pet.savedPlan = quizResult.recommendations;
    pet.hasRecommendations = true;
    pet.lastSavedPlanAt = new Date().toISOString();

    saveToStorage();

    Utils.showNotification('Plan guardado correctamente', 'success');
}

        };

        // Módulo de Panel de Administración
        const AdminModule = {
            // Verificar si el usuario actual es admin
            isAdmin: () => {
                return AppState.currentUser && AppState.currentUser.role === 'admin';
            },

            // Obtener estadísticas generales
            getStats: () => {
                return {
                    totalUsers: Database.users.length,
                    totalPets: Database.pets.length,
                    totalQuizzes: Database.quizResults ? Database.quizResults.length : 0,
                    activeToday: Database.sessions.filter(session => {
                        const sessionDate = new Date(session.createdAt).toDateString();
                        const today = new Date().toDateString();
                        return sessionDate === today;
                    }).length
                };
            },

            // Obtener usuarios recientes
            getRecentUsers: () => {
                return Database.users
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5);
            },

            // Obtener actividad reciente
            getRecentActivity: () => {
                const activities = [];
                
                // Agregar registros de usuarios
                Database.users.forEach(user => {
                    activities.push({
                        type: 'user_registered',
                        user: user.fullName,
                        timestamp: user.createdAt,
                        description: `${user.fullName} se registró en la plataforma`
                    });
                });

                // Agregar cuestionarios completados
                if (Database.quizResults) {
                    Database.quizResults.forEach(quiz => {
                        const user = Database.users.find(u => u.id === (quiz.userId || AppState.currentUser?.id));
                        activities.push({
                            type: 'quiz_completed',
                            user: user ? user.fullName : 'Usuario',
                            timestamp: quiz.completedAt,
                            description: `${user ? user.fullName : 'Usuario'} completó un cuestionario`
                        });
                    });
                }

                // Ordenar por fecha y limitar
                return activities
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 10);
            },

            // Métodos de UI para administración
            exportData: () => {
                const data = {
                    users: Database.users,
                    pets: Database.pets,
                    quizResults: Database.quizResults || [],
                    sessions: Database.sessions,
                    exportedAt: new Date().toISOString()
                };

                const dataStr = JSON.stringify(data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `smart-feeding-backup-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                
                Utils.showNotification('Datos exportados exitosamente', 'success');
            },

            manageUsers: () => {
                Utils.showNotification('Funcionalidad de gestión de usuarios en desarrollo', 'info');
            },

            systemInfo: () => {
                const info = {
                    platform: 'Smart Feeding',
                    version: '1.0.0',
                    users: Database.users.length,
                    pets: Database.pets.length,
                    storage: JSON.stringify(localStorage).length + ' bytes',
                    lastBackup: new Date().toISOString()
                };

                alert('Información del Sistema:\n' + JSON.stringify(info, null, 2));
            }
        };

        // Módulo de Renderizado
        const RenderModule = {
            // Renderizar página completa
            renderPage: (page) => {
                const mainContent = document.getElementById('main-content');
                
                // Mostrar loading
                mainContent.innerHTML = '<div class="loading">Cargando...</div>';

                // Renderizar según la página
                setTimeout(() => {
                    switch (page) {
                        case 'home':
                            mainContent.innerHTML = RenderModule.renderHomePage();
                            break;
                        case 'login':
                            mainContent.innerHTML = RenderModule.renderLoginPage();
                            break;
                        case 'register':
                            mainContent.innerHTML = RenderModule.renderRegisterPage();
                            break;
                        case 'dashboard':
                            if (!AppState.isLoggedIn) {
                                Router.navigate('/login');
                                return;
                            }
                            mainContent.innerHTML = RenderModule.renderDashboard();
                            break;
                        case 'pets':
                            if (!AppState.isLoggedIn) {
                                Router.navigate('/login');
                                return;
                            }
                            mainContent.innerHTML = RenderModule.renderPetsPage();
                            break;
                        case 'quiz':
                            if (!AppState.isLoggedIn) {
                                Router.navigate('/login');
                                return;
                            }
                            mainContent.innerHTML = RenderModule.renderQuizPage();
                            break;
                        case 'recommendations':
                            if (!AppState.isLoggedIn) {
                                Router.navigate('/login');
                                return;
                            }
                            mainContent.innerHTML = RenderModule.renderRecommendationsPage();
                            break;
                        case 'stats':
                            if (!AppState.isLoggedIn) {
                                Router.navigate('/login');
                                return;
                            }
                            mainContent.innerHTML = RenderModule.renderStatsPage();
                            try { StatsModule.drawCharts(); } catch (e) { /* noop */ }
                            break;
                        case 'community':
                            mainContent.innerHTML = RenderModule.renderCommunityPage();
                            break;
                        case 'admin':
                            mainContent.innerHTML = RenderModule.renderAdminPage();
                            break;
                        default:
                            mainContent.innerHTML = RenderModule.renderHomePage();
                    }

                    // Renderizar navegación
                    RenderModule.renderNavigation();
                }, 300);
            },

            // Renderizar navegación
            renderNavigation: () => {
                const app = document.getElementById('app');
                let nav = document.getElementById('main-nav');
                
                if (!nav) {
                    nav = document.createElement('nav');
                    nav.id = 'main-nav';
                    app.insertBefore(nav, app.firstChild);
                }

                nav.innerHTML = `
                    <div class="container">
                        <div class="nav-content">
                            <div class="nav-brand">
                                <i class="fas fa-paw"></i>
                                <span>Smart Feeding</span>
                            </div>
                            <div class="nav-links">
                                ${AppState.isLoggedIn ? `
                                    <a href="#" onclick="Router.navigate('/dashboard')">Dashboard</a>
                                    <a href="#" onclick="Router.navigate('/pets')">Mis Mascotas</a>
                                    <a href="#" onclick="Router.navigate('/quiz')">Cuestionario</a>
                                    <a href="#" onclick="Router.navigate('/recommendations')">Recomendaciones</a>
                                    <a href="#" onclick="Router.navigate('/stats')">Estadisticas</a>
                                    <a href="#" onclick="Router.navigate('/community')">Comunidad</a>
                                    ${AdminModule.isAdmin() ? '<a href="#" onclick="Router.navigate(\'/admin\')">Admin</a>' : ''}
                                    <div class="user-menu">
                                        <span>Hola, ${AppState.currentUser.fullName.split(' ')[0]}</span>
                                        <button onclick="AuthModule.logout()" class="btn btn-secondary">Cerrar Sesión</button>
                                    </div>
                                ` : `
                                    <a href="#" onclick="Router.navigate('/')">Inicio</a>
                                    <a href="#" onclick="Router.navigate('/login')">Iniciar Sesión</a>
                                    <a href="#" onclick="Router.navigate('/register')" class="btn btn-primary">Registrarse</a>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de inicio
            renderHomePage: () => {
                return `
                    <div class="hero-section">
                        <div class="container">
                            <div class="hero-content">
                                <h1>Nutrición Inteligente para tus Mascotas</h1>
                                <p>Plataforma para recomendaciones de alimentación personalizada según las necesidades específicas de tu mascota</p>
                                <div class="hero-actions">
                                    <button onclick="Router.navigate('/register')" class="btn btn-accent">Comenzar Ahora</button>
                                    <button onclick="Router.navigate('/quiz')" class="btn btn-secondary">Realizar Cuestionario</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="features-section">
                        <div class="container">
                            <div class="features-grid">
                                <div class="feature-card">
                                    <i class="fas fa-user-md"></i>
                                    <h3>Asesoramiento Expertos</h3>
                                    <p>Recomendaciones basadas en ciencia veterinaria</p>
                                </div>
                                <div class="feature-card">
                                    <i class="fas fa-paw"></i>
                                    <h3>Personalizado</h3>
                                    <p>Planes adaptados a raza, edad y condición de tu mascota</p>
                                </div>
                                <div class="feature-card">
                                    <i class="fas fa-chart-line"></i>
                                    <h3>Seguimiento</h3>
                                    <p>Monitorea el progreso y ajusta recomendaciones</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de login
            renderLoginPage: () => {
                return `
                    <div class="auth-container">
                        <div class="auth-card">
                            <h2>Iniciar Sesión</h2>
                            <form id="loginForm">
                                <div class="form-group">
                                    <label>Email:</label>
                                    <input type="email" id="loginEmail" required>
                                </div>
                                <div class="form-group">
                                    <label>Contraseña:</label>
                                    <input type="password" id="loginPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary btn-block">Iniciar Sesión</button>
                            </form>
                            <p>¿No tienes cuenta? <a href="#" onclick="Router.navigate('/register')">Regístrate aquí</a></p>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de registro
            renderRegisterPage: () => {
                return `
                    <div class="auth-container">
                        <div class="auth-card">
                            <h2>Crear Cuenta</h2>
                            <form id="registerForm">
                                <div class="form-group">
                                    <label>Nombre Completo:</label>
                                    <input type="text" id="registerName" required>
                                </div>
                                <div class="form-group">
                                    <label>Email:</label>
                                    <input type="email" id="registerEmail" required>
                                </div>
                                <div class="form-group">
                                    <label>Contraseña:</label>
                                    <input type="password" id="registerPassword" required minlength="6">
                                </div>
                                <button type="submit" class="btn btn-primary btn-block">Registrarse</button>
                            </form>
                            <p>¿Ya tienes cuenta? <a href="#" onclick="Router.navigate('/login')">Inicia sesión aquí</a></p>
                        </div>
                    </div>
                `;
            },

            // Renderizar dashboard
            renderDashboard: () => {
                return `
                    <div class="container">
                        <div class="dashboard-header">
                            <h1>Dashboard</h1>
                            <p>Bienvenido de nuevo, ${AppState.currentUser.fullName}</p>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <h3>${AppState.pets.length}</h3>
                                <p>Mascotas Registradas</p>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2>Acciones Rápidas</h2>
                            <div class="actions-grid">
                                <div class="action-card" onclick="Router.navigate('/pets')">
                                    <i class="fas fa-plus"></i>
                                    <span>Agregar Mascota</span>
                                </div>
                                <div class="action-card" onclick="Router.navigate('/quiz')">
                                    <i class="fas fa-clipboard-list"></i>
                                    <span>Realizar Cuestionario</span>
                                </div>
                                <div class="action-card" onclick="Router.navigate('/recommendations')">
                                    <i class="fas fa-chart-pie"></i>
                                    <span>Ver Recomendaciones</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de mascotas
            renderPetsPage: () => {
                const pets = AppState.pets;
                
                return `
                    <div class="container">
                        <div class="page-header">
                            <h1>Mis Mascotas</h1>
                            <button class="btn btn-accent" onclick="PetsModule.showAddPetModal()">
                                <i class="fas fa-plus"></i> Agregar Mascota
                            </button>
                        </div>

                        ${pets.length === 0 ? `
                            <div class="empty-state">
                                <i class="fas fa-paw"></i>
                                <h3>No tienes mascotas registradas</h3>
                                <p>Comienza agregando tu primera mascota para obtener recomendaciones personalizadas</p>
                                <button class="btn btn-accent" onclick="PetsModule.showAddPetModal()">
                                    Agregar Primera Mascota
                                </button>
                            </div>
                        ` : `
                            <div class="pets-grid">
                                ${pets.map(pet => `
                                    <div class="pet-card" onclick="PetsModule.showPetDetail('${pet.id}')">
                                        <div class="pet-avatar">
                                            <i class="fas fa-${pet.type === 'perro' ? 'dog' : 'cat'}"></i>
                                        </div>
                                        <div class="pet-info">
                                            <h3>${pet.name}</h3>
                                            <p>${pet.breed} • ${pet.age || 'Edad no especificada'}</p>
                                        </div>
                                        <div class="pet-actions">
                                            <button class="btn-icon" onclick="(event && event.stopPropagation()); PetsModule.showEditPetModal('${pet.id}')">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>

                    <!-- Modal para agregar/editar mascota -->
                    <div id="petModal" class="modal hidden">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3 id="petModalTitle">Agregar Mascota</h3>
                                <button class="btn-close" onclick="PetsModule.hidePetModal()">&times;</button>
                            </div>
                            <form id="petForm" onsubmit="return PetsModule.handlePetFormSubmit(event)">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Nombre *</label>
                                        <input type="text" id="petName" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Tipo *</label>
                                        <select id="petType" required onchange="PetsModule.updateBreeds()">
                                            <option value="">Seleccionar tipo</option>
                                            <option value="perro">Perro</option>
                                            <option value="gato">Gato</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Raza *</label>
                                        <select id="petBreed" required>
                                            <option value="">Seleccionar raza</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Edad (años)</label>
                                        <input type="number" id="petAge" min="0" max="30" step="0.1">
                                    </div>
                                    <div class="form-group">
                                        <label>Peso (kg)</label>
                                        <input type="number" id="petWeight" min="0" step="0.1">
                                    </div>
                                    <div class="form-group full-width">
                                        <label>Condiciones especiales</label>
                                        <textarea id="petConditions" rows="3" placeholder="Alergias, enfermedades crónicas, etc."></textarea>
                                    </div>
                                </div>
                                <div class="modal-actions">
                                    <button type="button" class="btn btn-secondary" onclick="PetsModule.hidePetModal()">Cancelar</button>
                                    <button type="submit" class="btn btn-primary">Guardar Mascota</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Modal de detalle de mascota -->
                    <div id="petDetailModal" class="modal hidden">
                        <div class="modal-content large">
                            <div class="modal-header">
                                <h3 id="petDetailTitle">Detalle de Mascota</h3>
                                <button class="btn-close" onclick="PetsModule.hidePetDetailModal()">&times;</button>
                            </div>
                            <div id="petDetailContent"></div>
                        </div>
                    </div>

                    <!-- Modal: Registrar Peso -->
                    <div id="weightModal" class="modal hidden">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>Registrar Peso</h3>
                                <button class="btn-close" onclick="PetsModule.hideWeightModal()">&times;</button>
                            </div>
                            <form id="weightForm" onsubmit="return PetsModule.handleWeightFormSubmit(event)">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Peso (kg) *</label>
                                        <input type="number" id="weightValue" min="0" step="0.1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Fecha</label>
                                        <input type="date" id="weightDate">
                                    </div>
                                </div>
                                <div class="modal-actions">
                                    <button type="button" class="btn btn-secondary" onclick="PetsModule.hideWeightModal()">Cancelar</button>
                                    <button type="submit" class="btn btn-primary">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Modal: Registrar Gasto -->
                    <div id="expenseModal" class="modal hidden">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>Registrar Gasto</h3>
                                <button class="btn-close" onclick="PetsModule.hideExpenseModal()">&times;</button>
                            </div>
                            <form id="expenseForm" onsubmit="return PetsModule.handleExpenseFormSubmit(event)">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Tipo</label>
                                        <select id="expenseType">
                                            <option value="comida">Comida</option>
                                            <option value="veterinario">Veterinario</option>
                                            <option value="accesorios">Accesorios</option>
                                            <option value="otros">Otros</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Importe</label>
                                        <input type="number" id="expenseAmount" min="0" step="0.01" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Fecha</label>
                                        <input type="date" id="expenseDate">
                                    </div>
                                </div>
                                <div class="modal-actions">
                                    <button type="button" class="btn btn-secondary" onclick="PetsModule.hideExpenseModal()">Cancelar</button>
                                    <button type="submit" class="btn btn-primary">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Modal: Registrar Alimentación -->
                    <div id="feedingModal" class="modal hidden">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h3>Registrar Alimentación</h3>
                                <button class="btn-close" onclick="PetsModule.hideFeedingModal()">&times;</button>
                            </div>
                            <form id="feedingForm" onsubmit="return PetsModule.handleFeedingFormSubmit(event)">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Cantidad (gramos) *</label>
                                        <input type="number" id="feedingGrams" min="0" step="1" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Tipo</label>
                                        <select id="feedingType">
                                            <option value="comida">Comida</option>
                                            <option value="seco">Seco</option>
                                            <option value="húmedo">Húmedo</option>
                                            <option value="casero">Casero</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Fecha</label>
                                        <input type="date" id="feedingDate">
                                    </div>
                                </div>
                                <div class="modal-actions">
                                    <button type="button" class="btn btn-secondary" onclick="PetsModule.hideFeedingModal()">Cancelar</button>
                                    <button type="submit" class="btn btn-primary">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de cuestionario
            renderQuizPage: () => {
                // Inicializar cuestionario si hay parámetro de mascota
                const urlParams = new URLSearchParams(window.location.search);
                const petId = urlParams.get('petId');
                
                if (petId && !QuizModule.currentPetId) {
                    QuizModule.init(petId);
                } else if (!QuizModule.currentPetId) {
                    QuizModule.init();
                }

                return `
                    <div class="container">
                        <div class="quiz-header">
                            <h1>Cuestionario de Nutrición</h1>
                            <p>Responde estas preguntas para obtener recomendaciones personalizadas</p>
                        </div>

                        <div class="quiz-progress-container">
                            <div class="quiz-progress-bar" style="width: ${(QuizModule.currentStep / QuizModule.totalSteps) * 100}%"></div>
                        </div>
                        <div class="quiz-progress-text">Paso ${QuizModule.currentStep} de ${QuizModule.totalSteps}</div>

                        <div id="quizContainer">
                            ${QuizModule.renderCurrentStep()}
                        </div>

                        <div class="quiz-navigation">
                            <button class="btn btn-secondary" onclick="QuizModule.prevStep()" 
                                    ${QuizModule.currentStep === 1 ? 'disabled' : ''}>
                                <i class="fas fa-arrow-left"></i> Anterior
                            </button>
                            
                            <button class="btn btn-accent" onclick="QuizModule.nextStep()">
                                ${QuizModule.currentStep === QuizModule.totalSteps ? 'Generar Recomendaciones' : 'Siguiente <i class="fas fa-arrow-right"></i>'}
                            </button>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de recomendaciones
            renderRecommendationsPage: () => {
                const quizResult = AppState.currentQuizResult || 
                                 (Database.quizResults && Database.quizResults[Database.quizResults.length - 1]);

                if (!quizResult) {
                    return `
                        <div class="container">
                            <div class="empty-state">
                                <i class="fas fa-clipboard-list"></i>
                                <h3>No hay recomendaciones disponibles</h3>
                                <p>Completa el cuestionario para obtener recomendaciones personalizadas</p>
                                <button class="btn btn-accent" onclick="Router.navigate('/quiz')">
                                    Realizar Cuestionario
                                </button>
                            </div>
                        </div>
                    `;
                }

                const recommendations = quizResult.recommendations;
                const pet = quizResult.petId ? PetsModule.getPetById(quizResult.petId) : null;

                return `


                        ${pet ? `
                            <div class="pet-banner">
                                <div class="pet-avatar">
                                    <i class="fas fa-${pet.type === 'perro' ? 'dog' : 'cat'}"></i>
                                </div>
                                <div class="pet-info">
                                    <h3>${pet.name}</h3>
                                    <p>${pet.breed} • ${pet.age ? pet.age + ' años' : 'Edad no especificada'}</p>
                                </div>
                            </div>
                        ` : ''}

                        <!-- Plan de Dieta -->
                        <div class="recommendation-section">
                            <h2><i class="fas fa-utensils"></i> Plan de Dieta</h2>
                            <div class="diet-plan">
                                <div class="diet-summary">
                                    <h3>${recommendations.dietPlan.type}</h3>
                                    <p>${recommendations.dietPlan.description}</p>
                                </div>
                                <div class="macronutrients">
                                    <div class="macro-card">
                                        <div class="macro-value">${recommendations.dietPlan.calories}</div>
                                        <div class="macro-label">Calorías</div>
                                    </div>
                                    <div class="macro-card">
                                        <div class="macro-value">${recommendations.dietPlan.protein}g</div>
                                        <div class="macro-label">Proteína</div>
                                    </div>
                                    <div class="macro-card">
                                        <div class="macro-value">${recommendations.dietPlan.fat}g</div>
                                        <div class="macro-label">Grasa</div>
                                    </div>
                                    <div class="macro-card">
                                        <div class="macro-value">${recommendations.dietPlan.carbs}g</div>
                                        <div class="macro-label">Carbohidratos</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Horario de Alimentación -->
                        <div class="recommendation-section">
                            <h2><i class="fas fa-clock"></i> Horario de Alimentación</h2>
                            <div class="schedule">
                                ${recommendations.feedingSchedule.times.map((time, index) => `
                                    <div class="schedule-item">
                                        <div class="time">${time}</div>
                                        <div class="portion">${recommendations.feedingSchedule.portions[index]}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Productos Recomendados -->
                        <div class="recommendation-section">
                            <h2><i class="fas fa-shopping-cart"></i> Productos Recomendados</h2>
                            <div class="products-grid">
                                ${recommendations.products.map(product => `
                                    <div class="product-card">
                                        <div class="product-header">
                                            <h4>${product.name}</h4>
                                            <span class="product-price">${product.price}</span>
                                        </div>
                                        <p class="product-description">${product.description}</p>
                                        <div class="product-benefits">
                                            ${product.benefits.map(benefit => `
                                                <span class="benefit-tag">${benefit}</span>
                                            `).join('')}
                                        </div>
                                        <div class="product-type">${product.type.toUpperCase()}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Consejos y Tips -->
                        <div class="recommendation-section">
                            <h2><i class="fas fa-lightbulb"></i> Consejos de Alimentación</h2>
                            <div class="tips-list">
                                ${recommendations.tips.map(tip => `
                                    <div class="tip-item">
                                        <i class="fas fa-check"></i>
                                        <span>${tip}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Advertencias -->
                        ${recommendations.warnings.length > 0 ? `
                            <div class="recommendation-section">
                                <h2><i class="fas fa-exclamation-triangle"></i> Advertencias Importantes</h2>
                                <div class="warnings-list">
                                    ${recommendations.warnings.map(warning => `
                                        <div class="warning-item">
                                            <i class="fas fa-exclamation-circle"></i>
                                            <span>${warning}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Acciones -->
                        <div class="recommendation-actions">
                            <button class="btn btn-accent" onclick="Router.navigate('/quiz')">
                                <i class="fas fa-redo"></i> Realizar Nuevo Cuestionario
                            </button>
                        </div>
                    </div>
                `;
            },

            // Renderizar página de administración
            renderAdminPage: () => {
                if (!AdminModule.isAdmin()) {
                    return `
                        <div class="container">
                            <div class="empty-state">
                                <i class="fas fa-lock"></i>
                                <h3>Acceso Restringido</h3>
                                <p>No tienes permisos para acceder al panel de administración</p>
                                <button class="btn btn-primary" onclick="Router.navigate('/dashboard')">
                                    Volver al Dashboard
                                </button>
                            </div>
                        </div>
                    `;
                }

                const stats = AdminModule.getStats();
                const recentUsers = AdminModule.getRecentUsers();
                const recentActivity = AdminModule.getRecentActivity();

                return `
                    <div class="container">
                        <div class="page-header">
                            <h1>Panel de Administración</h1>
                            <p>Gestión y monitoreo de la plataforma</p>
                        </div>

                        <!-- Estadísticas -->
                        <div class="stats-grid admin-stats">
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="stat-info">
                                    <h3>${stats.totalUsers}</h3>
                                    <p>Usuarios Registrados</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-paw"></i>
                                </div>
                                <div class="stat-info">
                                    <h3>${stats.totalPets}</h3>
                                    <p>Mascotas Registradas</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-clipboard-list"></i>
                                </div>
                                <div class="stat-info">
                                    <h3>${stats.totalQuizzes}</h3>
                                    <p>Cuestionarios Completados</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <div class="stat-info">
                                    <h3>${stats.activeToday}</h3>
                                    <p>Activos Hoy</p>
                                </div>
                            </div>
                        </div>

                        <div class="admin-content">
                            <!-- Usuarios Recientes -->
                            <div class="admin-section">
                                <h2>Usuarios Recientes</h2>
                                <div class="users-list">
                                    ${recentUsers.map(user => `
                                        <div class="user-item">
                                            <div class="user-avatar">
                                                <i class="fas fa-user"></i>
                                            </div>
                                            <div class="user-info">
                                                <h4>${user.fullName}</h4>
                                                <p>${user.email}</p>
                                                <small>Registrado: ${Utils.formatDate(user.createdAt)}</small>
                                            </div>
                                            <div class="user-stats">
                                                <span class="pets-count">
                                                    <i class="fas fa-paw"></i>
                                                    ${user.pets ? user.pets.length : 0}
                                                </span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Actividad Reciente -->
                            <div class="admin-section">
                                <h2>Actividad Reciente</h2>
                                <div class="activity-list">
                                    ${recentActivity.map(activity => `
                                        <div class="activity-item">
                                            <div class="activity-icon">
                                                <i class="fas fa-${activity.type === 'user_registered' ? 'user-plus' : 'clipboard-check'}"></i>
                                            </div>
                                            <div class="activity-content">
                                                <p>${activity.description}</p>
                                                <small>${Utils.formatDate(activity.timestamp)}</small>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Herramientas de Administración -->
                            <div class="admin-section">
                                <h2>Herramientas</h2>
                                <div class="tools-grid">
                                    <div class="tool-card" onclick="AdminModule.exportData()">
                                        <i class="fas fa-download"></i>
                                        <h4>Exportar Datos</h4>
                                        <p>Exportar toda la información de la plataforma</p>
                                    </div>
                                    
                                    <div class="tool-card" onclick="AdminModule.manageUsers()">
                                        <i class="fas fa-cog"></i>
                                        <h4>Gestión de Usuarios</h4>
                                        <p>Administrar usuarios y permisos</p>
                                    </div>
                                    
                                    <div class="tool-card" onclick="AdminModule.systemInfo()">
                                        <i class="fas fa-info-circle"></i>
                                        <h4>Información del Sistema</h4>
                                        <p>Ver estadísticas y estado del sistema</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        };

        // Inicialización de la aplicación
        document.addEventListener('DOMContentLoaded', () => {
            // Verificar autenticación
            AuthModule.checkAuth();
            
            // Módulos añadidos: Estadísticas y Comunidad
            const StatsModule = {
                selectedPetId: null,
                selectedPeriod: 'mensual',
                setSelection: (petId, period) => {
                    StatsModule.selectedPetId = petId;
                    if (period) StatsModule.selectedPeriod = period;
                },
                getSelection: () => {
                    const petId = StatsModule.selectedPetId || (AppState.pets[0] ? AppState.pets[0].id : null);
                    return { petId, period: StatsModule.selectedPeriod };
                },
                keyForDate: (dateStr, period) => {
                    const d = new Date(dateStr);
                    const y = d.getFullYear();
                    const m = (d.getMonth()+1).toString().padStart(2,'0');
                    const day = d.getDate().toString().padStart(2,'0');
                    if (period === 'diario') return `${y}-${m}-${day}`;
                    if (period === 'mensual') return `${y}-${m}`;
                    const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                    const dayNum = temp.getUTCDay() || 7;
                    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(),0,1));
                    const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1)/7);
                    return `${temp.getUTCFullYear()}-W${weekNo.toString().padStart(2,'0')}`;
                },
                aggregate: (pet, period) => {
                    if (!pet) return { weight: [], expenses: [], feedings: [], totals: {avgWeight: '0.0', totalExpenses: '0.00', totalFeedGrams: '0'} };
                    const weightHistory = pet.weightHistory || [];
                    const expenses = pet.expenseHistory || [];
                    const feedings = pet.feedingHistory || [];
                    const weightGroups = {};
                    weightHistory.forEach(w => {
                        const key = StatsModule.keyForDate(w.date, period);
                        if (!weightGroups[key]) weightGroups[key] = [];
                        weightGroups[key].push(w.weight);
                    });
                    const weight = Object.entries(weightGroups)
                        .sort((a,b)=> a[0] < b[0] ? -1 : 1)
                        .map(([label, arr]) => ({ label, value: (arr.reduce((s,x)=>s+x,0)/arr.length).toFixed(1) }));
                    const expenseGroups = {};
                    expenses.forEach(ex => {
                        const key = StatsModule.keyForDate(ex.date, period);
                        if (!expenseGroups[key]) expenseGroups[key] = 0;
                        expenseGroups[key] += ex.amount;
                    });
                    const expensesAgg = Object.entries(expenseGroups)
                        .sort((a,b)=> a[0] < b[0] ? -1 : 1)
                        .map(([label, value]) => ({ label, value: value.toFixed(2) }));
                    const feedingGroups = {};
                    feedings.forEach(f => {
                        const key = StatsModule.keyForDate(f.date, period);
                        if (!feedingGroups[key]) feedingGroups[key] = 0;
                        feedingGroups[key] += f.grams || 0;
                    });
                    const feedingsAgg = Object.entries(feedingGroups)
                        .sort((a,b)=> a[0] < b[0] ? -1 : 1)
                        .map(([label, value]) => ({ label, value: Number(value.toFixed(0)) }));
                    const avgWeight = weightHistory.length ? (weightHistory.reduce((a,w)=>a+w.weight,0)/weightHistory.length) : 0;
                    const totalExpenses = expenses.reduce((a,e)=>a+e.amount,0);
                    const totalFeedGrams = feedings.reduce((a,f)=>a+(f.grams||0),0);
                return { weight, expenses: expensesAgg, feedings: feedingsAgg, totals: { avgWeight: avgWeight.toFixed(1), totalExpenses: totalExpenses.toFixed(2), totalFeedGrams: String(Math.round(totalFeedGrams)) } };
            },
            drawCharts: () => {
                const sel = StatsModule.getSelection();
                const pet = sel.petId ? PetsModule.getPetById(sel.petId) : (AppState.pets[0] || null);
                if (!pet) return;
                const agg = StatsModule.aggregate(pet, sel.period || 'mensual');
                const weightCanvas = document.getElementById('weightChart');
                const expenseCanvas = document.getElementById('expenseChart');
                const feedingCanvas = document.getElementById('feedingChart');
                if (weightCanvas) {
                    const ctx = weightCanvas.getContext('2d');
                    StatsModule.drawBarChart(ctx, agg.weight.map(r=>r.label), agg.weight.map(r=>parseFloat(r.value)), { color: '#4a90e2' });
                }
                if (expenseCanvas) {
                    const ctx2 = expenseCanvas.getContext('2d');
                    StatsModule.drawBarChart(ctx2, agg.expenses.map(r=>r.label), agg.expenses.map(r=>parseFloat(r.value)), { color: '#e67e22' });
                }
                if (feedingCanvas) {
                    const ctx3 = feedingCanvas.getContext('2d');
                    StatsModule.drawBarChart(ctx3, agg.feedings.map(r=>r.label), agg.feedings.map(r=>parseFloat(r.value)), { color: '#27ae60' });
                }
            },
            drawBarChart: (ctx, labels, values, { color = '#4a90e2' } = {}) => {
                const W = ctx.canvas.width = ctx.canvas.clientWidth;
                const H = ctx.canvas.height = ctx.canvas.height;
                ctx.clearRect(0,0,W,H);
                const padL = 40, padB = 30, padT = 10, padR = 10;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const maxV = Math.max(1, ...values);
                const barW = Math.max(6, Math.floor(plotW / Math.max(1, values.length*1.5)));
                const gap = values.length > 0 ? (plotW - barW*values.length) / Math.max(1, values.length-1) : plotW;
                // axes
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(padL, padT);
                ctx.lineTo(padL, padT+plotH);
                ctx.lineTo(padL+plotW, padT+plotH);
                ctx.stroke();
                // bars
                ctx.fillStyle = color;
                values.forEach((v, i) => {
                    const h = (v / maxV) * (plotH - 2);
                    const x = padL + i * (barW + gap);
                    const y = padT + plotH - h;
                    ctx.fillRect(x, y, barW, h);
                });
                // y labels (0 and max)
                ctx.fillStyle = '#666';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('0', padL-6, padT+plotH);
                ctx.fillText(maxV.toFixed(0), padL-6, padT+10);
            }
        };

            // Community enhancements: filters, moderation, images, tags, and overrides
            CommunityModule.filter = { query: '', topic: 'all' };
            CommunityModule.bannedWords = ['ilegal','odio','violencia extrema','terrorismo','abuso','pornografia'];
            CommunityModule.moderate = (text) => {
                const lowered = (text || '').toLowerCase();
                const found = CommunityModule.bannedWords.find(w => lowered.includes(w));
                return found ? { ok: false, reason: `Contenido no permitido: '${found}'` } : { ok: true };
            };
            CommunityModule.getPosts = () => {
                const all = (Database.communityPosts || []).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
                const q = CommunityModule.filter.query.trim().toLowerCase();
                const t = CommunityModule.filter.topic;
                return all.filter(p => {
                    const matchesTopic = (t === 'all') || (p.topic === t) || (p.tags || []).includes(t);
                    const matchesQuery = !q || (p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || (p.tags||[]).some(tag => tag.toLowerCase().includes(q)));
                    return matchesTopic && matchesQuery;
                });
            };
            CommunityModule.createPost = (title, content, topic='general', images = [], tags = []) => {
                if (!AppState.currentUser) { Utils.showNotification('Debes iniciar sesión para publicar', 'error'); return; }
                if (!title || !content) { Utils.showNotification('Título y contenido son obligatorios', 'error'); return; }
                const mod = CommunityModule.moderate(`${title} ${content}`);
                if (!mod.ok) { Utils.showNotification(mod.reason, 'error'); return; }
                const post = {
                    id: Utils.generateId(),
                    userId: AppState.currentUser.id,
                    author: AppState.currentUser.fullName,
                    authorRole: AppState.currentUser.role || 'user',
                    topic, title, content,
                    tags,
                    images,
                    createdAt: new Date().toISOString(),
                    comments: [], likes: []
                };
                Database.communityPosts.push(post);
                saveToStorage();
                Utils.showNotification('Publicación creada', 'success');
                RenderModule.renderPage('community');
            };
            CommunityModule.handleNewPostSubmit = (e) => {
                e.preventDefault();
                const title = document.getElementById('newPostTitle').value.trim();
                const content = document.getElementById('newPostContent').value.trim();
                const topic = document.getElementById('newPostTopic').value;
                const tagsStr = (document.getElementById('newPostTags')?.value || '').trim();
                const tags = tagsStr ? tagsStr.split(',').map(t=>t.trim()).filter(Boolean) : [];
                const input = document.getElementById('newPostImages');
                const files = input ? Array.from(input.files || []).slice(0,3) : [];
                if (!files.length) { CommunityModule.createPost(title, content, topic, [], tags); return false; }
                const readers = files.map(file => new Promise((resolve) => {
                    if (!/^image\//.test(file.type) || file.size > 1024*1024*2) return resolve(null);
                    const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(null); fr.readAsDataURL(file);
                }));
                Promise.all(readers).then(images => {
                    const valid = images.filter(Boolean);
                    CommunityModule.createPost(title, content, topic, valid, tags);
                });
                return false;
            };

            const CommunityModule = {
                topics: ['general','alimentación','salud','entrenamiento'],
                getPosts: () => (Database.communityPosts || []).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt)),
                createPost: (title, content, topic='general') => {
                    if (!AppState.currentUser) { Utils.showNotification('Debes iniciar sesión para publicar', 'error'); return; }
                    if (!title || !content) { Utils.showNotification('Título y contenido son obligatorios', 'error'); return; }
                    const post = {
                        id: Utils.generateId(),
                        userId: AppState.currentUser.id,
                        author: AppState.currentUser.fullName,
                        authorRole: AppState.currentUser.role || 'user',
                        topic, title, content,
                        createdAt: new Date().toISOString(),
                        comments: [], likes: []
                    };
                    Database.communityPosts.push(post);
                    saveToStorage();
                    Utils.showNotification('Publicación creada', 'success');
                    RenderModule.renderPage('community');
                },
                addComment: (postId, text) => {
                    if (!AppState.currentUser) { Utils.showNotification('Debes iniciar sesión para comentar', 'error'); return; }
                    const post = Database.communityPosts.find(p=>p.id===postId);
                    if (!post || !text) return;
                    post.comments.push({
                        id: Utils.generateId(), userId: AppState.currentUser.id,
                        author: AppState.currentUser.fullName,
                        authorRole: AppState.currentUser.role || 'user',
                        text, createdAt: new Date().toISOString()
                    });
                    saveToStorage();
                    RenderModule.renderPage('community');
                },
                toggleLike: (postId) => {
                    if (!AppState.currentUser) { Utils.showNotification('Debes iniciar sesión para reaccionar', 'error'); return; }
                    const post = Database.communityPosts.find(p=>p.id===postId);
                    if (!post) return;
                    const idx = post.likes.indexOf(AppState.currentUser.id);
                    if (idx === -1) post.likes.push(AppState.currentUser.id); else post.likes.splice(idx,1);
                    saveToStorage();
                    RenderModule.renderPage('community');
                },
                handleNewPostSubmit: (e) => {
                    e.preventDefault();
                    const title = document.getElementById('newPostTitle').value.trim();
                    const content = document.getElementById('newPostContent').value.trim();
                    const topic = document.getElementById('newPostTopic').value;
                    CommunityModule.createPost(title, content, topic);
                    return false;
                },
                handleAddComment: (postId) => {
                    const input = document.getElementById(`commentInput_${postId}`);
                    const text = input.value.trim();
                    if (!text) return;
                    CommunityModule.addComment(postId, text);
                }
            };

            // Render functions assignment (added)
            RenderModule.renderStatsPage = () => {
                const pets = AppState.pets;
                if (!pets || pets.length === 0) {
                    return `
                        <div class="container">
                            <div class="empty-state">
                                <i class="fas fa-paw"></i>
                                <h3>No hay mascotas</h3>
                                <p>Agrega una mascota para ver sus estadísticas</p>
                                <button class="btn btn-accent" onclick="Router.navigate('/pets')">Agregar Mascota</button>
                            </div>
                        </div>
                    `;
                }
                const sel = StatsModule.getSelection();
                const pet = sel.petId ? PetsModule.getPetById(sel.petId) : pets[0];
                const period = sel.period || 'mensual';
                const agg = StatsModule.aggregate(pet, period);
                return `
                    <div class="container">
                        <div class="page-header">
                            <h1>Estadísticas</h1>
                            <div class="filters-bar">
                                <select id="statsPetSelect" onchange="StatsModule.setSelection(this.value); RenderModule.renderPage('stats')">
                                    ${pets.map(p=>`<option value="${p.id}" ${p.id===pet.id?'selected':''}>${p.name}</option>`).join('')}
                                </select>
                                <select id="statsPeriodSelect" onchange="StatsModule.setSelection('${pet.id}', this.value); RenderModule.renderPage('stats')">
                                    <option value="diario" ${period==='diario'?'selected':''}>Diario</option>
                                    <option value="semanal" ${period==='semanal'?'selected':''}>Semanal</option>
                                    <option value="mensual" ${period==='mensual'?'selected':''}>Mensual</option>
                                </select>
                            </div>
                        </div>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <h3>${agg.totals.avgWeight} kg</h3>
                                <p>Peso promedio</p>
                            </div>
                            <div class="stat-card">
                                <h3>${agg.totals.totalExpenses} €</h3>
                                <p>Gasto total</p>
                            </div>
                        </div>

                        <div class="card">
                            <h2>Gráfico de Peso (${period})</h2>
                            <canvas id="weightChart" height="220"></canvas>
                        </div>

                        <div class="card">
                            <h2>Gráfico de Gastos (${period})</h2>
                            <canvas id="expenseChart" height="220"></canvas>
                        </div>
                        <div class="card">
                            <h2>Grafico de Alimentacion (${period})</h2>
                            <canvas id="feedingChart" height="220"></canvas>
                        </div>
                        <div class="card">
                            <h2>Tendencia de Peso (${period})</h2>
                            <div class="table-responsive">
                                <table class="stats-table">
                                    <thead><tr><th>Periodo</th><th>Peso promedio (kg)</th></tr></thead>
                                    <tbody>
                                        ${agg.weight.map(r=>`<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="card">
                            <h2>Gastos (${period})</h2>
                            <div class="table-responsive">
                                <table class="stats-table">
                                    <thead><tr><th>Periodo</th><th>Importe (€)</th></tr></thead>
                                    <tbody>
                                        ${agg.expenses.map(r=>`<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            };

            RenderModule.renderCommunityPage = () => {
                const posts = CommunityModule.getPosts();
                const canPost = !!AppState.currentUser;
                return `
                    <div class="container">
                        <div class="page-header">
                            <h1>Comunidad</h1>
                            <div class="filters-bar" style="margin-top:10px;">
                                <input type="text" placeholder="Buscar por tema, título o etiqueta" value="${CommunityModule.filter.query}"
                                       oninput="CommunityModule.filter.query=this.value; RenderModule.renderPage('community')" />
                                <select onchange="CommunityModule.filter.topic=this.value; RenderModule.renderPage('community')">
                                    <option value="all" ${CommunityModule.filter.topic==='all'?'selected':''}>Todos</option>
                                    ${CommunityModule.topics.map(t=>`<option value="${t}" ${CommunityModule.filter.topic===t?'selected':''}>${t}</option>`).join('')}
                                </select>
                            </div>
                            ${canPost ? '' : '<p class="text-muted">Inicia sesión para publicar y comentar</p>'}
                        </div>
                        ${canPost ? `
                        <div class="card">
                            <h3>Crear publicación</h3>
                            <form id="newPostForm" onsubmit="return CommunityModule.handleNewPostSubmit(event)">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label>Título</label>
                                        <input id="newPostTitle" type="text" required />
                                    </div>
                                    <div class="form-group">
                                        <label>Tema</label>
                                        <select id="newPostTopic">
                                            ${CommunityModule.topics.map(t=>`<option value="${t}">${t}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Etiquetas</label>
                                        <input id="newPostTags" type="text" placeholder="p.ej. husky, sobrepeso" />
                                    </div>
                                    <div class="form-group">
                                        <label>Imágenes (hasta 3)</label>
                                        <input id="newPostImages" type="file" accept="image/*" multiple />
                                    </div>
                                    <div class="form-group full-width">
                                        <label>Contenido</label>
                                        <textarea id="newPostContent" rows="3" required></textarea>
                                    </div>
                                </div>
                                <div class="modal-actions">
                                    <button type="submit" class="btn btn-primary">Publicar</button>
                                </div>
                            </form>
                        </div>` : ''}
                        <div class="community-list">
                            ${posts.map(p=>`
                                <div class="post-card">
                                    <div class="post-header">
                                        <h3>${p.title}</h3>
                                        <div class="post-meta">
                                            <span class="badge topic">${p.topic}</span>
                                            <span class="author">${p.author}${p.authorRole==='vet' ? ' <span class="badge vet">Vet</span>' : ''}</span>
                                            <span class="date">${Utils.formatDate(p.createdAt)}</span>
                                        </div>
                                    </div>
                                    <p class="post-content">${p.content}</p>
                                    ${(p.tags && p.tags.length) ? `<div class="post-tags">${p.tags.map(t=>`<span class=\"badge\">#${t}</span>`).join(' ')}</div>` : ''}
                                    ${(p.images && p.images.length) ? `
                                        <div class="image-grid">
                                            ${p.images.map(src=>`<img src=\"${src}\" alt=\"imagen\" />`).join('')}
                                        </div>
                                    ` : ''}
                                    <div class="post-actions">
                                        <button class="btn btn-secondary" onclick="CommunityModule.toggleLike('${p.id}')">
                                            <i class="fas fa-heart"></i> ${p.likes.length}
                                        </button>
                                    </div>
                                    <div class="comments">
                                        <h4>Comentarios</h4>
                                        ${p.comments.map(c=>`
                                            <div class="comment-item">
                                                <div class="comment-head">
                                                    <span class="author">${c.author}${c.authorRole==='vet' ? ' <span class=\"badge vet\">Vet</span>' : ''}</span>
                                                    <span class="date">${Utils.formatDate(c.createdAt)}</span>
                                                </div>
                                                <div class="comment-text">${c.text}</div>
                                            </div>
                                        `).join('')}
                                        ${canPost ? `
                                            <div class="comment-form">
                                                <input id="commentInput_${p.id}" type="text" placeholder="Escribe un comentario..." />
                                                <button class="btn btn-primary" onclick="CommunityModule.handleAddComment('${p.id}')">Comentar</button>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            };

            // Inicializar router (con fallback hash si se abre via file://)
            try {
                if (window.location.protocol === 'file:') {
                    Router.navigate = (path) => {
                        const route = Router.routes[path] || 'home';
                        AppState.currentPage = route;
                        RenderModule.renderPage(route);
                        const hashPath = path === '/' ? '' : path;
                        if (window.location.hash !== '#' + hashPath) {
                            window.location.hash = '#' + hashPath;
                        }
                    };
                    Router.init = () => {
                        window.addEventListener('hashchange', () => {
                            const hash = window.location.hash.replace(/^#/, '');
                            const path = hash || '/';
                            Router.navigate(path);
                        });
                        const initialPath = (window.location.hash.replace(/^#/, '') || '/');
                        Router.navigate(initialPath);
                    };
                }
            } catch (_) { /* noop */ }
            Router.init();

            // Manejar formularios
            document.addEventListener('submit', (e) => {
                e.preventDefault();
                
                if (e.target.id === 'loginForm') {
                    const email = document.getElementById('loginEmail').value;
                    const password = document.getElementById('loginPassword').value;
                    
                    AuthModule.login(email, password)
                        .then(() => {
                            Utils.showNotification('¡Bienvenido!', 'success');
                            Router.navigate('/dashboard');
                        })
                        .catch(error => {
                            Utils.showNotification(error, 'error');
                        });
                }

                if (e.target.id === 'registerForm') {
                    const userData = {
                        fullName: document.getElementById('registerName').value,
                        email: document.getElementById('registerEmail').value,
                        password: document.getElementById('registerPassword').value
                    };

                    AuthModule.register(userData)
                        .then(() => {
                            Utils.showNotification('¡Cuenta creada exitosamente!', 'success');
                            Router.navigate('/dashboard');
                        })
                        .catch(error => {
                            Utils.showNotification(error, 'error');
                        });
                }
            });
        });
// ============================================================
// 📊 MÓDULO DE ESTADÍSTICAS (StatsModule) - versión con calendario interactivo
// ============================================================
const StatsModule = {
    drawCharts: () => {
        const container = document.getElementById('main-content');
        if (!container) return;

        const allPets = Database.pets || [];

        container.innerHTML = `
            <div class="container">
                <h2 class="text-center">📈 Estadísticas y Registros Diarios</h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${allPets.length}</h3>
                        <p>Mascotas Registradas</p>
                    </div>
                    <div class="stat-card">
                        <h3>${allPets.reduce((acc, p) => acc + (p.weightHistory?.length || 0), 0)}</h3>
                        <p>Registros de Peso</p>
                    </div>
                    <div class="stat-card">
                        <h3>${allPets.reduce((acc, p) => acc + (p.expenseHistory?.length || 0), 0)}</h3>
                        <p>Registros de Gastos</p>
                    </div>
                </div>

                <div class="card" style="margin-top: 40px;">
                    <h3>📅 Registrar datos diarios</h3>
                    <form id="registerDataForm" class="form-grid" onsubmit="StatsModule.addPetData(event)">
                        <div class="form-group">
                            <label>Mascota</label>
                            <select id="petSelect" required>
                                <option value="">Selecciona una mascota</option>
                                ${allPets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Peso (kg)</label>
                            <input type="number" id="weightInput" min="0" step="0.1" required>
                        </div>

                        <div class="form-group">
                            <label>Gasto (COP)</label>
                            <input type="number" id="expenseInput" min="0" step="0.1" required>
                        </div>

                        <div class="form-group full-width" style="text-align: right;">
                            <button type="submit" class="btn btn-accent">Guardar registro</button>
                        </div>
                    </form>
                </div>

                <div class="card" style="margin-top: 40px;">
    <h3>📊 Gráficas</h3>
    <canvas id="weightChart" height="120"></canvas>

    <div class="form-group" style="margin-top: 30px;">
        <label>Seleccionar mes:</label>
        <select id="monthSelect" onchange="StatsModule.renderCharts()"></select>
    </div>

    <canvas id="expenseChart" height="120" style="margin-top: 20px;"></canvas>
</div>


                <div class="card" style="margin-top: 40px;">
                    <h3>📅 Historial de registros</h3>
                    <div id="calendarContainer" class="calendar-grid"></div>
                    <div id="dayRecords" class="card text-center" style="margin-top: 20px;"></div>
                </div>
            </div>
        `;

        // Cargar Chart.js si no está presente
        if (typeof Chart === "undefined") {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/chart.js";
            script.onload = StatsModule.renderCharts;
            document.body.appendChild(script);
        } else {
            StatsModule.renderCharts();
        }

        StatsModule.renderCalendar();
    },

    renderCharts: () => {
    const pets = Database.pets || [];

    // Generar lista de meses disponibles
    const allMonths = new Set();
    pets.forEach(p => {
        (p.expenseHistory || []).forEach(e => {
            const date = new Date(e.date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            allMonths.add(monthStr);
        });
    });

    const sortedMonths = Array.from(allMonths).sort().reverse();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthSelect = document.getElementById("monthSelect");

    // Si el selector no existe, salir (evita errores si aún no se ha renderizado)
    if (!monthSelect) return;

    monthSelect.innerHTML = sortedMonths
        .map(m => {
            const [year, month] = m.split("-");
            const label = new Date(year, month - 1)
                .toLocaleString("es-ES", { month: "long", year: "numeric" })
                .toUpperCase();
            return `<option value="${m}" ${m === currentMonth ? "selected" : ""}>${label}</option>`;
        })
        .join("");

    // Obtener mes seleccionado
    const selectedMonth = monthSelect.value || currentMonth;

    const labels = pets.map(p => p.name);
    const avgWeights = pets.map(p => {
        const w = p.weightHistory || [];
        return w.length ? (w.reduce((a, b) => a + b.weight, 0) / w.length).toFixed(1) : 0;
    });

    // Filtrar gastos del mes seleccionado
    const monthExpenses = pets.map(p => {
        const e = (p.expenseHistory || []).filter(exp => exp.date.startsWith(selectedMonth));
        const total = e.reduce((a, b) => a + b.amount, 0);
        return total;
    });

    // Gráfico de Peso
    const ctxWeight = document.getElementById("weightChart");
    if (StatsModule.weightChart) StatsModule.weightChart.destroy();
    StatsModule.weightChart = new Chart(ctxWeight, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Peso promedio (kg)",
                data: avgWeights,
                backgroundColor: "rgba(230, 126, 34, 0.7)"
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Gráfico de Gastos Mensuales (COP)
    const ctxExpense = document.getElementById("expenseChart");
    if (StatsModule.expenseChart) StatsModule.expenseChart.destroy();
    StatsModule.expenseChart = new Chart(ctxExpense, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: `Gastos mensuales (${selectedMonth})`,
                data: monthExpenses,
                backgroundColor: "rgba(39, 174, 96, 0.7)"
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value =>
                            `$${value.toLocaleString("es-CO", {
                                maximumFractionDigits: 0
                            })}`
                    }
                }
            }
        }
    });
},

    addPetData: (e) => {
        e.preventDefault();

        const petId = document.getElementById("petSelect").value;
        const weight = parseFloat(document.getElementById("weightInput").value);
        const expense = parseFloat(document.getElementById("expenseInput").value);

        const pet = Database.pets.find(p => p.id === petId);
        if (!pet) return;

        pet.weightHistory = pet.weightHistory || [];
        pet.expenseHistory = pet.expenseHistory || [];

        const today = new Date().toISOString().split("T")[0];

        pet.weightHistory.push({ date: today, weight });
        pet.expenseHistory.push({ date: today, amount: expense });

        saveToStorage();
        Utils.showNotification("Registro diario guardado correctamente ✅", "success");

        StatsModule.renderCharts();
        StatsModule.renderCalendar();
    },

    renderCalendar: () => {
        const container = document.getElementById("calendarContainer");
        if (!container) return;

        const allPets = Database.pets || [];
        const allDates = new Set();

        allPets.forEach(pet => {
            (pet.weightHistory || []).forEach(r => allDates.add(r.date));
            (pet.expenseHistory || []).forEach(r => allDates.add(r.date));
        });

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        let html = `<div class="calendar-header">
            <h4>${today.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</h4>
        </div><div class="calendar-days">`;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isRegistered = allDates.has(dateStr);
            html += `<div class="calendar-day ${isRegistered ? 'active' : ''}" onclick="StatsModule.showDayRecords('${dateStr}')">${day}</div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
    },

    showDayRecords: (date) => {
        const allPets = Database.pets || [];
        const dayContainer = document.getElementById("dayRecords");

        const records = [];

        allPets.forEach(pet => {
            (pet.weightHistory || []).forEach(r => {
                if (r.date === date)
                    records.push({ name: pet.name, type: "Peso", value: `${r.weight} kg` });
            });
            (pet.expenseHistory || []).forEach(r => {
                if (r.date === date)
                    records.push({ name: pet.name, type: "Gasto", value: `${r.amount.toLocaleString("es-CO", { style: "currency", currency: "COP" })}` });
            });
        });

        if (records.length === 0) {
            dayContainer.innerHTML = `<p>📭 No hay registros para el ${date}</p>`;
        } else {
            dayContainer.innerHTML = `
                <h4>📅 Registros del ${date}</h4>
                <ul style="list-style:none; padding:0;">
                    ${records.map(r => `<li><strong>${r.name}</strong> — ${r.type}: ${r.value}</li>`).join('')}
                </ul>
            `;
        }
    }
};





// ============================================================
// 🐾 MÓDULO DE COMUNIDAD (CommunityModule) - versión con imágenes y consultas veterinarias
// ============================================================
const CommunityModule = {
    render: () => {
        const posts = Database.communityPosts || [];
        const currentSection = AppState.currentCommunitySection || "posts";

        let content = "";

        // 📌 Sección de publicaciones normales
        if (currentSection === "posts") {
            content = `
                <div class="page-header">
                    <h2>🐶 Comunidad Smart Feeding</h2>
                    <div class="community-tabs">
                        <button class="btn btn-accent" onclick="CommunityModule.switchSection('posts')">Publicaciones</button>
                        <button class="btn btn-secondary" onclick="CommunityModule.switchSection('vets')">Veterinarios</button>
                    </div>
                    ${AppState.isLoggedIn ? `
                    <button class="btn btn-accent" onclick="CommunityModule.showNewPostForm()">
                        <i class="fas fa-pen"></i> Nuevo Post
                    </button>` : ''}
                </div>

                <div class="community-list">
                    ${posts.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-comments"></i>
                            <p>Aún no hay publicaciones. ¡Sé el primero en compartir algo!</p>
                        </div>
                    ` : posts.map(p => `
                        <div class="post-card">
                            <div class="post-header">
                                <h3>${p.title}</h3>
                                <span class="badge">${p.category || 'General'}</span>
                            </div>
                            <div class="post-meta">
                                <i class="fas fa-user"></i> ${p.author}
                                <span>•</span>
                                <i class="fas fa-clock"></i> ${Utils.formatDate(p.createdAt)}
                            </div>
                            ${p.image ? `<img src="${p.image}" class="post-image">` : ''}
                            <div class="post-content">
                                <p>${p.content}</p>
                            </div>
                            ${p.comments && p.comments.length > 0 ? `
                                <div class="comments">
                                    ${p.comments.map(c => `
                                        <div class="comment-item">
                                            <div class="comment-head">
                                                <strong>${c.author}</strong>
                                                <small>${Utils.formatDate(c.date)}</small>
                                            </div>
                                            <p>${c.text}</p>
                                            ${c.image ? `<img src="${c.image}" class="comment-image">` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${AppState.isLoggedIn ? `
                                <form class="comment-form" onsubmit="CommunityModule.addComment(event, '${p.id}')">
                                    <input type="text" placeholder="Escribe un comentario..." required />
                                    <input type="file" accept="image/*" />
                                    <button type="submit" class="btn btn-accent">Enviar</button>
                                </form>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 🩺 Sección de veterinarios
        else if (currentSection === "vets") {
            const vetQuestions = Database.vetQuestions || [];
            content = `
                <div class="page-header">
                    <h2>🩺 Consultas con Veterinarios</h2>
                    <div class="community-tabs">
                        <button class="btn btn-secondary" onclick="CommunityModule.switchSection('posts')">Publicaciones</button>
                        <button class="btn btn-accent" onclick="CommunityModule.switchSection('vets')">Veterinarios</button>
                    </div>
                </div>

                <div class="card">
                    <form id="vetQuestionForm" class="form-grid" onsubmit="CommunityModule.submitVetQuestion(event)">
                        <div class="form-group full-width">
                            <label>Haz una pregunta a un veterinario:</label>
                            <textarea id="vetQuestion" rows="3" required></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label>Subir imagen (opcional):</label>
                            <input type="file" id="vetImage" accept="image/*">
                        </div>
                        <div class="form-group full-width" style="text-align:right;">
                            <button type="submit" class="btn btn-accent">Enviar consulta</button>
                        </div>
                    </form>
                </div>

                <div class="community-list" style="margin-top: 30px;">
                    ${vetQuestions.length === 0 ? `
                        <div class="empty-state">
                            <i class="fas fa-stethoscope"></i>
                            <p>No hay consultas aún. ¡Haz tu primera pregunta!</p>
                        </div>
                    ` : vetQuestions.map(q => `
                        <div class="post-card">
                            <div class="post-header">
                                <h3>Consulta de ${q.author}</h3>
                                <small>${Utils.formatDate(q.date)}</small>
                            </div>
                            <div class="post-content">
                                <p>${q.text}</p>
                                ${q.image ? `<img src="${q.image}" class="post-image">` : ''}
                            </div>
                            ${q.reply ? `
                                <div class="vet-reply">
                                    <i class="fas fa-user-md"></i> <strong>Veterinario:</strong>
                                    <p>${q.reply}</p>
                                </div>
                            ` : '<p><em>Esperando respuesta de un veterinario...</em></p>'}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `<div class="container">${content}</div>`;
    },

    // Cambiar entre pestañas
    switchSection: (section) => {
        AppState.currentCommunitySection = section;
        Router.navigate("/community");
    },

    showNewPostForm: () => {
        const container = document.getElementById("main-content");
        container.innerHTML = `
            <div class="container">
                <h2>✏️ Crear Nueva Publicación</h2>
                <form id="newPostForm" class="form-grid" onsubmit="CommunityModule.submitNewPost(event)">
                    <div class="form-group full-width">
                        <label>Título</label>
                        <input type="text" id="postTitle" required>
                    </div>
                    <div class="form-group full-width">
                        <label>Categoría</label>
                        <input type="text" id="postCategory" placeholder="Ejemplo: Alimentación, Salud...">
                    </div>
                    <div class="form-group full-width">
                        <label>Contenido</label>
                        <textarea id="postContent" rows="4" required></textarea>
                    </div>
                    <div class="form-group full-width">
                        <label>Imagen (opcional)</label>
                        <input type="file" id="postImage" accept="image/*">
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-accent">Publicar</button>
                        <button type="button" class="btn btn-secondary" onclick="Router.navigate('/community')">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
    },

    submitNewPost: (e) => {
        e.preventDefault();
        const title = document.getElementById("postTitle").value.trim();
        const category = document.getElementById("postCategory").value.trim();
        const content = document.getElementById("postContent").value.trim();
        const imageFile = document.getElementById("postImage").files[0];

        const reader = new FileReader();
        reader.onloadend = () => {
            const newPost = {
                id: Utils.generateId(),
                author: AppState.currentUser ? AppState.currentUser.fullName : "Anónimo",
                title,
                category: category || "General",
                content,
                createdAt: new Date().toISOString(),
                image: reader.result || null,
                comments: []
            };

            Database.communityPosts.push(newPost);
            saveToStorage();
            Utils.showNotification("Publicación creada correctamente", "success");
            Router.navigate("/community");
        };

        if (imageFile) reader.readAsDataURL(imageFile);
        else reader.onloadend();
    },

    addComment: (e, postId) => {
        e.preventDefault();
        const input = e.target.querySelector("input[type='text']");
        const imageInput = e.target.querySelector("input[type='file']");
        const text = input.value.trim();
        if (!text) return;

        const post = Database.communityPosts.find(p => p.id === postId);
        if (!post) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            post.comments = post.comments || [];
            post.comments.push({
                id: Utils.generateId(),
                author: AppState.currentUser ? AppState.currentUser.fullName : "Invitado",
                text,
                image: reader.result || null,
                date: new Date().toISOString()
            });

            saveToStorage();
            Utils.showNotification("Comentario agregado", "success");
            Router.navigate("/community");
        };

        if (imageInput.files[0]) reader.readAsDataURL(imageInput.files[0]);
        else reader.onloadend();
    },

    submitVetQuestion: (e) => {
        e.preventDefault();
        const text = document.getElementById("vetQuestion").value.trim();
        const imageFile = document.getElementById("vetImage").files[0];

        const reader = new FileReader();
        reader.onloadend = () => {
            const question = {
                id: Utils.generateId(),
                author: AppState.currentUser ? AppState.currentUser.fullName : "Usuario",
                text,
                image: reader.result || null,
                date: new Date().toISOString(),
                reply: null
            };

            Database.vetQuestions = Database.vetQuestions || [];
            Database.vetQuestions.push(question);
            saveToStorage();
            Utils.showNotification("Consulta enviada correctamente 🩺", "success");
            Router.navigate("/community");
        };

        if (imageFile) reader.readAsDataURL(imageFile);
        else reader.onloadend();
    }
};


// ============================================================
// 🧠 Conectar los nuevos módulos al renderizador
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof RenderModule !== "undefined") {
        RenderModule.renderStatsPage = () => `
            <section class="container">
                ${StatsModule.drawCharts()}
            </section>
        `;

        RenderModule.renderCommunityPage = () => CommunityModule.render();
    }
});
