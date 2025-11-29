'use strict';

class QdrawApp {
    constructor() {
        this.interpreter = new QdrawInterpreter(8, 8);
        this.editor = null;
        this.monaco = null;
        
        // Elementos del DOM
        this.boardElement = document.getElementById('board');
        this.statusMessage = document.getElementById('statusMessage');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.headPosition = document.getElementById('headPosition');
        
        // Botones
        this.runBtn = document.getElementById('runBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.toggleViewBtn = document.getElementById('toggleViewBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.fileInput = document.getElementById('fileInput');
        
        // Controles
        this.speedControl = document.getElementById('speedControl');
        this.widthInput = document.getElementById('widthInput');
        this.heightInput = document.getElementById('heightInput');
        this.resizeBtn = document.getElementById('resizeBtn');

        // Estado
        this.isShiftPressed = false;
        this.zoomLevel = 1;
        this.initialBoard = null;
        this.finalBoard = null;
        this.showingInitial = false;
        this.errorDecorations = [];
        this.currentExecutor = null;
        
        this.init();
    }

    async init() {
        await this.initMonacoEditor();
        this.renderBoard();
        this.updateStatus();
        this.attachEventListeners();
    }

    // =====================================================
    // CONFIGURACIÓN DEL EDITOR MONACO
    // =====================================================

    async initMonacoEditor() {
        return new Promise((resolve, reject) => {
            require.config({ 
                paths: { 
                    'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' 
                }
            });

            require(['vs/editor/editor.main'], () => {
                this.monaco = monaco;
                
                // Registrar lenguaje Qdraw
                this.registerQdrawLanguage();
                
                // Crear editor
                this.editor = monaco.editor.create(document.getElementById('monacoEditor'), {
                    value: this.getDefaultCode(),
                    language: 'qdraw',
                    theme: 'qdraw-theme',
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    folding: false,
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    bracketPairColorization: { enabled: true },
                    autoIndent: 'full',
                    formatOnType: true,
                    formatOnPaste: true,
                    tabSize: 4,
                    insertSpaces: true
                });

                // Evento de cambio del editor
                this.editor.onDidChangeModelContent(() => {
                    this.updateControls();
                    this.clearErrors();
                });

                resolve();
            });
        });
    }

    registerQdrawLanguage() {
        // Registrar lenguaje
        monaco.languages.register({ id: 'qdraw' });

        // Configurar lenguaje
        monaco.languages.setLanguageConfiguration('qdraw', {
            comments: {
                blockComment: ['/*', '*/']
            },
            brackets: [
                ['{', '}'],
                ['(', ')']
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '(', close: ')' },
                { open: '/*', close: '*/' }
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '(', close: ')' }
            ],
            folding: {
                markers: {
                    start: /^\s*\{\s*$/,
                    end: /^\s*\}\s*$/
                }
            }
        });

        // Configurar Tokenizador
        monaco.languages.setMonarchTokensProvider('qdraw', {
            keywords: [
                'programa', 'procedimiento', 'si', 'sino', 
                'repetir', 'veces'
            ],
            commands: [
                'MoverArriba', 'MoverAbajo', 'MoverDerecha', 'MoverIzquierda',
                'PintarNegro', 'PintarRojo', 'PintarVerde', 'Limpiar'
            ],
            sensors: [
                'estaVacia?', 'estaPintadaDeNegro?', 
                'estaPintadaDeRojo?', 'estaPintadaDeVerde?'
            ],
            
            tokenizer: {
                root: [
                    // Comentarios
                    [/\/\*/, 'comment', '@comment'],
                    
                    // Keywords
                    [/\b(programa|procedimiento|si|sino|repetir|veces)\b/, 'keyword'],
                    
                    // Comandos
                    [/\b(Mover(Arriba|Abajo|Derecha|Izquierda)|Pintar(Negro|Rojo|Verde)|Limpiar)\b/, 'command'],
                    
                    // Sensores
                    [/\b(estaVacia\?|estaPintada(DeNegro|DeRojo|DeVerde)\?)\b/, 'sensor'],
                    
                    // Números
                    [/\d+/, 'number'],
                    
                    // Identificadores
                    [/[a-zA-Z_]\w*/, 'identifier'],
                    
                    // Delimitadores
                    [/[{}()\[\]]/, '@brackets'],
                    
                    // Espacios en blanco
                    [/\s+/, 'white']
                ],
                
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\*\//, 'comment', '@pop'],
                    [/[\/*]/, 'comment']
                ]
            }
        });

        // Definir tema
        monaco.editor.defineTheme('qdraw-theme', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
                { token: 'command', foreground: '098658', fontStyle: 'bold' },
                { token: 'sensor', foreground: 'AF00DB' },
                { token: 'number', foreground: '098658' },
                { token: 'comment', foreground: '008000', fontStyle: 'italic' },
                { token: 'identifier', foreground: '001080' }
            ],
            colors: {
                'editor.foreground': '#000000',
                'editor.background': '#FFFFFF',
                'editorLineNumber.foreground': '#237893',
                'editor.selectionBackground': '#ADD6FF',
                'editor.inactiveSelectionBackground': '#E5EBF1'
            }
        });
    }

    getDefaultCode() {
        return ``;
    }

    // =====================================================
    // RENDERIZADO DEL TABLERO
    // =====================================================

    renderBoard() {
        this.boardElement.innerHTML = '';
        this.boardElement.style.gridTemplateColumns = `repeat(${this.interpreter.width}, 45px)`;
        this.boardElement.style.gridTemplateRows = `repeat(${this.interpreter.height}, 45px)`;

        // Crear celdas (de arriba hacia abajo)
        for (let y = this.interpreter.height - 1; y >= 0; y--) {
            for (let x = 0; x < this.interpreter.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;

                const color = this.interpreter.getCellColor(x, y);
                if (color) {
                    cell.classList.add(color);
                }

                if (x === this.interpreter.headX && y === this.interpreter.headY) {
                    cell.classList.add('head');
                }

                cell.addEventListener('click', (e) => this.handleCellClick(e, x, y));

                this.boardElement.appendChild(cell);
            }
        }
        
        this.addBoardCoordinates();
        this.updateBoardState();
    }
    
    addBoardCoordinates() {
        const wrapper = document.querySelector('.board-wrapper');
        const oldCoords = wrapper.querySelectorAll('.board-coordinates');
        oldCoords.forEach(coord => coord.remove());
        
        // Coordenadas superiores (X)
        const topCoords = document.createElement('div');
        topCoords.className = 'board-coordinates coord-top';
        for (let x = 0; x < this.interpreter.width; x++) {
            const span = document.createElement('span');
            span.textContent = x;
            span.style.width = '45px';
            span.style.textAlign = 'center';
            topCoords.appendChild(span);
        }
        wrapper.appendChild(topCoords);
        
        // Coordenadas inferiores (X)
        const bottomCoords = document.createElement('div');
        bottomCoords.className = 'board-coordinates coord-bottom';
        for (let x = 0; x < this.interpreter.width; x++) {
            const span = document.createElement('span');
            span.textContent = x;
            span.style.width = '45px';
            span.style.textAlign = 'center';
            bottomCoords.appendChild(span);
        }
        wrapper.appendChild(bottomCoords);
        
        // Coordenadas izquierdas (Y)
        const leftCoords = document.createElement('div');
        leftCoords.className = 'board-coordinates coord-left';
        for (let y = this.interpreter.height - 1; y >= 0; y--) {
            const span = document.createElement('span');
            span.textContent = y;
            span.style.height = '45px';
            span.style.display = 'flex';
            span.style.alignItems = 'center';
            leftCoords.appendChild(span);
        }
        wrapper.appendChild(leftCoords);
        
        // Coordenadas derechas (Y)
        const rightCoords = document.createElement('div');
        rightCoords.className = 'board-coordinates coord-right';
        for (let y = this.interpreter.height - 1; y >= 0; y--) {
            const span = document.createElement('span');
            span.textContent = y;
            span.style.height = '45px';
            span.style.display = 'flex';
            span.style.alignItems = 'center';
            rightCoords.appendChild(span);
        }
        wrapper.appendChild(rightCoords);
    }

    updateBoardState() {
        this.boardElement.classList.remove('executing', 'teleport-enabled', 'no-teleport');
        
        switch (this.interpreter.state) {
            case 'editing':
                if (this.isShiftPressed) {
                    this.boardElement.classList.add('teleport-enabled');
                }
                break;
            case 'running':
                this.boardElement.classList.add('executing', 'no-teleport');
                break;
            case 'finished':
            case 'error':
                this.boardElement.classList.add('no-teleport');
                break;
        }
    }

    handleCellClick(e, x, y) {
        if (this.interpreter.state !== 'editing') return;
        
        if (this.isShiftPressed) {
            // Teletransportar cabezal
            if (this.interpreter.teleport(x, y)) {
                this.renderBoard();
                this.updateStatus();
            }
        } else {
            // Ciclar colores: Vacío -> rojo -> verde -> negro -> Vacío
            const currentColor = this.interpreter.getCellColor(x, y);
            let newColor;
            
            if (currentColor === null) {
                newColor = 'rojo';
            } else if (currentColor === 'rojo') {
                newColor = 'verde';
            } else if (currentColor === 'verde') {
                newColor = 'negro';
            } else {
                newColor = null;
            }
            
            this.interpreter.grid[y][x] = newColor;
            this.renderBoard();
        }
    }
    
    resizeBoard(width, height) {
        this.interpreter.width = width;
        this.interpreter.height = height;
        this.interpreter.grid = this.interpreter.createGrid();
        
        // Ajustar cabezal si está fuera de los límites
        if (this.interpreter.headX >= width) {
            this.interpreter.headX = 0;
        }
        if (this.interpreter.headY >= height) {
            this.interpreter.headY = 0;
        }
        
        this.interpreter.state = 'editing';
        this.renderBoard();
        this.updateStatus('Tablero redimensionado');
    }

    // =====================================================
    // ACTUALIZACIONES DE ESTADO
    // =====================================================

    updateStatus(message = null) {
        const pos = this.interpreter.getHeadPosition();
        this.headPosition.textContent = `(${pos.x}, ${pos.y})`;

        if (message) {
            this.statusMessage.textContent = message;
        }

        // Actualizar indicador de estado
        this.statusIndicator.className = 'status-indicator';
        
        switch (this.interpreter.state) {
            case 'editing':
                this.statusIndicator.classList.add('status-editing');
                this.statusIndicator.textContent = 'Edición';
                if (!message) {
                    this.statusMessage.textContent = 'Listo para ejecutar';
                    this.statusMessage.classList.remove('error');
                }
                break;
            case 'running':
                this.statusIndicator.classList.add('status-running');
                this.statusIndicator.textContent = 'Ejecutando...';
                this.statusMessage.textContent = 'Programa en ejecución...';
                this.statusMessage.classList.remove('error');
                break;
            case 'finished':
                this.statusIndicator.classList.add('status-finished');
                this.statusIndicator.textContent = 'Finalizado';
                this.statusMessage.textContent = 'Ejecución completada con éxito ✓';
                this.statusMessage.classList.remove('error');
                break;
            case 'error':
                this.statusIndicator.classList.add('status-error');
                this.statusIndicator.textContent = 'Error';
                this.statusMessage.classList.add('error');
                break;
        }

        this.updateBoardState();
        this.updateControls();
    }

    updateControls() {
        const isEditing = this.interpreter.state === 'editing';
        const isRunning = this.interpreter.state === 'running';
        const hasCode = this.editor && this.editor.getValue().trim().length > 0;

        this.runBtn.disabled = !isEditing || !hasCode;
        this.resetBtn.disabled = isRunning;
        this.widthInput.disabled = !isEditing;
        this.heightInput.disabled = !isEditing;
        this.resizeBtn.disabled = !isEditing;
        this.speedControl.disabled = isRunning;
        this.exportBtn.disabled = isRunning;
        this.importBtn.disabled = isRunning;
        
        if (this.editor) {
            this.editor.updateOptions({ readOnly: !isEditing });
        }
    }

    // =====================================================
    // MANEJO DE ERRORES
    // =====================================================

    clearErrors() {
        if (this.editor && this.errorDecorations.length > 0) {
            this.errorDecorations = this.editor.deltaDecorations(this.errorDecorations, []);
        }
        this.removeBoomMessage();
    }

    showError(message, lineNumber = null) {
        this.interpreter.state = 'error';
        this.updateStatus(message);
        
        if (lineNumber && this.editor) {
            // Resaltar línea de error
            this.errorDecorations = this.editor.deltaDecorations(this.errorDecorations, [
                {
                    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                    options: {
                        isWholeLine: true,
                        className: 'error-line',
                        glyphMarginClassName: 'error-glyph',
                        glyphMarginHoverMessage: { value: message }
                    }
                }
            ]);
            
            // Desplazarse a la línea de error
            this.editor.revealLineInCenter(lineNumber);
        }
        
        this.showBoomMessage(message);
    }
    
    showBoomMessage(message) {
        const container = document.querySelector('.board-container');
        const boomDiv = document.createElement('div');
        boomDiv.className = 'boom-message';
        boomDiv.id = 'boomMessage';
        boomDiv.innerHTML = `
            <div class="boom-title"><span class="boom-icon">✗</span>BOOM</div>
            <div class="boom-text">${this.escapeHtml(message)}</div>
        `;
        container.appendChild(boomDiv);
    }
    
    removeBoomMessage() {
        const existing = document.getElementById('boomMessage');
        if (existing) {
            existing.remove();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    attachEventListeners() {
        // Eventos de teclado para detección de Shift
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.isShiftPressed = true;
                this.updateBoardState();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.isShiftPressed = false;
                this.updateBoardState();
            }
        });

        // Botón de ejecutar
        this.runBtn.addEventListener('click', () => this.runProgram());
        
        // Botón de detener
        this.stopBtn.addEventListener('click', () => this.stopProgram());

        // Botón de reiniciar
        this.resetBtn.addEventListener('click', () => this.reset());
        
        // Botón de alternar vista
        this.toggleViewBtn.addEventListener('click', () => this.toggleView());

        // Botón de redimensionar
        this.resizeBtn.addEventListener('click', () => {
            const width = parseInt(this.widthInput.value);
            const height = parseInt(this.heightInput.value);
            
            if (width >= 1 && width <= 30 && height >= 1 && height <= 30) {
                this.resizeBoard(width, height);
            } else {
                this.updateStatus('Dimensiones inválidas (debe ser entre 1 y 30)');
            }
        });

        // Botón de exportar
        this.exportBtn.addEventListener('click', () => this.exportCode());

        // Botón de importar
        this.importBtn.addEventListener('click', () => this.fileInput.click());

        // Entrada de archivo
        this.fileInput.addEventListener('change', (e) => this.importCode(e));
        
        // Zoom con rueda del mouse en el tablero
        const boardContainer = document.querySelector('.board-container');
        boardContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomLevel = Math.max(0.3, Math.min(3, this.zoomLevel + delta));
            
            const wrapper = document.querySelector('.board-wrapper');
            wrapper.style.transform = `scale(${this.zoomLevel})`;
            wrapper.style.transformOrigin = 'center center';
        }, { passive: false });
    }

    // =====================================================
    // EJECUCIÓN DEL PROGRAMA
    // =====================================================

    async runProgram() {
        const code = this.editor.getValue();
        
        if (!code.trim()) {
            this.updateStatus('No hay código para ejecutar');
            return;
        }

        this.clearErrors();
        
        // Guardar estado inicial (incluyendo posición del cabezal)
        this.initialBoard = this.interpreter.cloneState();
        this.initialHeadX = this.interpreter.headX;
        this.initialHeadY = this.interpreter.headY;

        try {
            // Tokenizar
            const tokenizer = new QdrawTokenizer(code);
            const tokens = tokenizer.tokenize();

            // Parsear
            const parser = new QdrawParser(tokens);
            const ast = parser.parse();

            // Ejecutar
            this.interpreter.state = 'running';
            this.interpreter.speed = parseInt(this.speedControl.value);
            this.updateStatus();
            
            // Mostrar botón de detener, ocultar botón de ejecutar
            this.runBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-block';
            
            this.currentExecutor = new QdrawExecutor(
                this.interpreter,
                ast,
                () => {
                    this.renderBoard();
                    this.updateStatus();
                }
            );

            const result = await this.currentExecutor.execute();
            
            // Ocultar botón de detener, mostrar botón de ejecutar
            this.stopBtn.style.display = 'none';
            this.runBtn.style.display = 'inline-block';
            this.currentExecutor = null;

            if (result.success) {
                this.interpreter.state = 'finished';
                this.updateStatus(result.message);
                
                // Guardar estado final y mostrar botón de alternar vista
                this.finalBoard = this.interpreter.cloneState();
                this.toggleViewBtn.style.display = 'inline-block';
                this.showingInitial = false;
            } else {
                this.handleExecutionError(result.message);
            }

            this.renderBoard();

        } catch (error) {
            // Ocultar botón de detener, mostrar botón de ejecutar
            this.stopBtn.style.display = 'none';
            this.runBtn.style.display = 'inline-block';
            this.currentExecutor = null;
            
            this.handleExecutionError(error.message);
            this.renderBoard();
        }
    }
    
    stopProgram() {
        if (this.currentExecutor) {
            this.currentExecutor.cancel();
            this.updateStatus('Ejecución detenida por el usuario');
        }
    }
    
    handleExecutionError(errorMessage) {
        // Extraer número de línea del mensaje de error
        const lineMatch = errorMessage.match(/Línea (\d+)/);
        const lineNumber = lineMatch ? parseInt(lineMatch[1]) : null;
        
        this.showError(errorMessage, lineNumber);
    }

    reset() {
        this.clearErrors();
        this.initialBoard = null;
        this.finalBoard = null;
        this.showingInitial = false;
        this.toggleViewBtn.style.display = 'none';
        
        // Reiniciar el tablero
        this.interpreter.reset();
        
        // Restaurar posición inicial del cabezal (si se guardó antes de ejecutar)
        if (this.initialHeadX !== undefined && this.initialHeadY !== undefined) {
            this.interpreter.headX = this.initialHeadX;
            this.interpreter.headY = this.initialHeadY;
        }
        
        this.renderBoard();
        this.updateStatus('Tablero reiniciado');
    }
    
    toggleView() {
        if (!this.initialBoard || !this.finalBoard) return;
        
        this.showingInitial = !this.showingInitial;
        
        if (this.showingInitial) {
            this.interpreter.restoreState(this.initialBoard);
            this.toggleViewBtn.textContent = '🔄 Ver Final';
        } else {
            this.interpreter.restoreState(this.finalBoard);
            this.toggleViewBtn.textContent = '🔄 Ver Inicial';
        }
        
        this.renderBoard();
        this.updateStatus();
    }

    // =====================================================
    // OPERACIONES DE ARCHIVO
    // =====================================================

    exportCode() {
        const code = this.editor.getValue();
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'programa.qdraw';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus('Código exportado exitosamente');
    }

    importCode(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validar extensión del archivo
        const validExtensions = ['.qdraw', '.txt'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            this.updateStatus('Error: Solo se permiten archivos .qdraw o .txt');
            this.fileInput.value = '';
            return;
        }

        // Validar tamaño del archivo (máximo 500KB)
        const maxSize = 500 * 1024; // 500KB en bytes
        if (file.size > maxSize) {
            this.updateStatus('Error: El archivo es demasiado grande (máximo 500KB)');
            this.fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            
            // Sanitizar contenido (eliminar posibles scripts maliciosos)
            const sanitized = this.sanitizeCode(content);
            
            this.editor.setValue(sanitized);
            this.updateStatus(`Código cargado desde ${file.name}`);
            this.fileInput.value = '';
        };
        
        reader.onerror = () => {
            this.updateStatus('Error al leer el archivo');
            this.fileInput.value = '';
        };
        
        reader.readAsText(file);
    }

    sanitizeCode(code) {
        // Eliminar cualquier etiqueta HTML/script potencial (seguridad)
        return code.replace(/<script.*?>.*?<\/script>/gis, '')
                   .replace(/<.*?>/g, '')
                   .substring(0, 500 * 1024); // Limitar a 500KB
    }

    // async loadExample() {
    //     try {
    //         const response = await fetch('ejemplo_avanzado.txt');
    //         if (!response.ok) {
    //             throw new Error('No se pudo cargar el ejemplo');
    //         }
    //         const content = await response.text();
    //         const sanitized = this.sanitizeCode(content);
            
    //         this.editor.setValue(sanitized);
            
    //         // Redimensionar tablero para ajustar el ejemplo (necesita mínimo 19x12)
    //         this.widthInput.value = '20';
    //         this.heightInput.value = '12';
    //         this.resizeBoard(20, 12);
            
    //         this.updateStatus('Ejemplo avanzado cargado exitosamente');
    //     } catch (error) {
    //         this.updateStatus('Error al cargar el ejemplo: ' + error.message);
    //     }
    // }
}

// =====================================================
// INICIALIZAR APP
// =====================================================

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new QdrawApp();
});
