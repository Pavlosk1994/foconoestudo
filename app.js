document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const timeDisplay = document.getElementById('time-display');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const modeText = document.getElementById('mode-text');
    
    const taskInput = document.getElementById('task-input');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    
    const streakDisplay = document.getElementById('streak-display');
    
    // --- Configurações e Estado ---
    const FOCUS_TIME = 25 * 60;
    const BREAK_TIME = 5 * 60;
    
    let timeLeft = FOCUS_TIME;
    let timerId = null;
    let targetTime = null;
    let isFocusMode = true;
    
    // Dados salvos localmente
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let streakData = JSON.parse(localStorage.getItem('streakData')) || { count: 0, lastDate: null };
    
    const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 

    // --- Lógica do Pomodoro ---
    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const seconds = (Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
        const timeString = `${minutes}:${seconds}`;
        
        timeDisplay.textContent = timeString;
        
        const modeString = isFocusMode ? 'Foco' : 'Pausa';
        document.title = `(${timeString}) ${modeString}`;
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    function sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    function switchMode(focus) {
        isFocusMode = focus;
        timeLeft = isFocusMode ? FOCUS_TIME : BREAK_TIME;
        
        modeText.textContent = isFocusMode ? 'MODO: FOCO' : 'MODO: PAUSA';
        modeText.style.color = isFocusMode ? 'var(--title-bg)' : 'var(--magenta)';
            
        updateDisplay();
        pauseTimer();
    }

    function startTimer() {
        if (timerId !== null) return;
        requestNotificationPermission(); 
        
        targetTime = Date.now() + (timeLeft * 1000);
        
        timerId = setInterval(() => {
            const now = Date.now();
            timeLeft = Math.round((targetTime - now) / 1000);
            
            if (timeLeft > 0) {
                updateDisplay();
            } else {
                timeLeft = 0;
                updateDisplay();
                pauseTimer();
                
                alertSound.play().catch(e => console.log('Som automático bloqueado.', e));
                
                const msg = isFocusMode ? 'O tempo de foco acabou! Pausa.' : 'A pausa acabou! De volta ao foco.';
                sendNotification('Pomodoro.exe', msg);
                
                switchMode(!isFocusMode);
            }
        }, 500);
    }

    function pauseTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function resetTimer() {
        pauseTimer();
        timeLeft = isFocusMode ? FOCUS_TIME : BREAK_TIME;
        updateDisplay();
    }

    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    // --- Lógica de Tarefas (Floppy Checkboxes) ---
    function renderTasks() {
        taskList.innerHTML = '';

        if (tasks.length === 0) {
            const empty = document.createElement('li');
            empty.style.padding = '12px';
            empty.style.color = 'var(--title-bg)';
            empty.style.fontSize = '0.85rem';
            empty.textContent = 'Aguardando inputs...';
            taskList.appendChild(empty);
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'task-completed' : ''}`;
            
            // Checkbox Clássico
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'custom-checkbox';
            checkbox.checked = task.completed;
            checkbox.title = 'Marcar/Desmarcar';
            checkbox.addEventListener('change', () => toggleTask(task.id));
            
            const span = document.createElement('span');
            span.textContent = task.text;
            span.className = 'task-text';
            
            const delBtn = document.createElement('button');
            delBtn.innerHTML = 'X';
            delBtn.className = 'btn-action';
            delBtn.style.padding = '4px 8px';
            delBtn.style.margin = '0';
            delBtn.style.boxShadow = '2px 2px 0px var(--btn-border)'; // menor sombra no botão de del
            delBtn.title = 'Deletar tarefa';
            delBtn.addEventListener('click', () => deleteTask(task.id));
            
            li.appendChild(checkbox);
            li.appendChild(span);
            li.appendChild(delBtn);
            taskList.appendChild(li);
        });
        
        checkStreak();
    }

    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;
        const newTask = {
            id: Date.now().toString(),
            text,
            completed: false
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        taskInput.value = '';
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderTasks();
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // --- Lógica de Ofensiva (Streak) ---
    function checkStreak() {
        const todayDate = new Date().toISOString().split('T')[0];
        
        if (streakData.lastDate && streakData.count > 0) {
            const lastDateObj = new Date(streakData.lastDate);
            const todayObj = new Date(todayDate);
            const diffTime = Math.abs(todayObj - lastDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays > 1) {
                streakData.count = 0;
                localStorage.setItem('streakData', JSON.stringify(streakData));
            }
        }

        const allCompleted = tasks.length > 0 && tasks.every(t => t.completed);
        
        if (allCompleted) {
            if (streakData.lastDate !== todayDate) {
                if (!streakData.lastDate || streakData.count === 0) {
                    streakData.count = 1;
                } else {
                    const lastDateObj = new Date(streakData.lastDate);
                    const todayObj = new Date(todayDate);
                    const diffTime = Math.abs(todayObj - lastDateObj);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays === 1) {
                        streakData.count++;
                    } else if (diffDays > 1) {
                        streakData.count = 1;
                    }
                }
                
                streakData.lastDate = todayDate;
                localStorage.setItem('streakData', JSON.stringify(streakData));
            }
        }
        
        streakDisplay.textContent = streakData.count;
    }

    // --- Inicialização ---
    updateDisplay();
    renderTasks();
});
