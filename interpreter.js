// =====================================================
// QDRAW INTERPRETER - ARQUITECTURA MODULAR
// =====================================================
// Autor: Franco Aranda
// Descripción: Intérprete completo para el lenguaje Qdraw
// con tokenización, parsing AST, y ejecución segura
// =====================================================

'use strict';

// =====================================================
// CONSTANTES Y CONFIGURACIÓN
// =====================================================

const QDRAW_CONFIG = {
    MAX_EXECUTION_STEPS: 100000,      // Límite de pasos para evitar loops infinitos
    MAX_RECURSION_DEPTH: 1000,         // Límite de profundidad de recursión
    MAX_BOARD_SIZE: 50,                // Tamaño máximo del tablero
    MIN_BOARD_SIZE: 1,                 // Tamaño mínimo del tablero
    ANIMATION_DELAYS: {
        SLOW: 500,
        NORMAL: 150,
        FAST: 30,
        INSTANT: 0
    }
};

const TOKEN_TYPES = {
    // Keywords
    PROGRAMA: 'PROGRAMA',
    PROCEDIMIENTO: 'PROCEDIMIENTO',
    SI: 'SI',
    SINO: 'SINO',
    REPETIR: 'REPETIR',
    VECES: 'VECES',
    
    // Comandos
    MOVER_ARRIBA: 'MOVER_ARRIBA',
    MOVER_ABAJO: 'MOVER_ABAJO',
    MOVER_DERECHA: 'MOVER_DERECHA',
    MOVER_IZQUIERDA: 'MOVER_IZQUIERDA',
    PINTAR_NEGRO: 'PINTAR_NEGRO',
    PINTAR_ROJO: 'PINTAR_ROJO',
    PINTAR_VERDE: 'PINTAR_VERDE',
    LIMPIAR: 'LIMPIAR',
    
    // Sensores
    ESTA_VACIA: 'ESTA_VACIA',
    ESTA_PINTADA_NEGRO: 'ESTA_PINTADA_NEGRO',
    ESTA_PINTADA_ROJO: 'ESTA_PINTADA_ROJO',
    ESTA_PINTADA_VERDE: 'ESTA_PINTADA_VERDE',
    
    // Símbolos
    LBRACE: 'LBRACE',           // {
    RBRACE: 'RBRACE',           // }
    LPAREN: 'LPAREN',           // (
    RPAREN: 'RPAREN',           // )
    
    // Literales
    NUMBER: 'NUMBER',
    IDENTIFIER: 'IDENTIFIER',
    
    // Control
    COMMENT: 'COMMENT',
    NEWLINE: 'NEWLINE',
    EOF: 'EOF'
};

const COLORS = {
    ROJO: 'rojo',
    VERDE: 'verde',
    NEGRO: 'negro',
    EMPTY: null
};

// =====================================================
// TOKENIZER (LEXER)
// =====================================================

class QdrawTokenizer {
    constructor(sourceCode) {
        this.source = sourceCode;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        
        // Keywords map
        this.keywords = {
            'programa': TOKEN_TYPES.PROGRAMA,
            'procedimiento': TOKEN_TYPES.PROCEDIMIENTO,
            'si': TOKEN_TYPES.SI,
            'sino': TOKEN_TYPES.SINO,
            'repetir': TOKEN_TYPES.REPETIR,
            'veces': TOKEN_TYPES.VECES,
            'MoverArriba': TOKEN_TYPES.MOVER_ARRIBA,
            'MoverAbajo': TOKEN_TYPES.MOVER_ABAJO,
            'MoverDerecha': TOKEN_TYPES.MOVER_DERECHA,
            'MoverIzquierda': TOKEN_TYPES.MOVER_IZQUIERDA,
            'PintarNegro': TOKEN_TYPES.PINTAR_NEGRO,
            'PintarRojo': TOKEN_TYPES.PINTAR_ROJO,
            'PintarVerde': TOKEN_TYPES.PINTAR_VERDE,
            'Limpiar': TOKEN_TYPES.LIMPIAR,
            'estaVacia?': TOKEN_TYPES.ESTA_VACIA,
            'estaPintadaDeNegro?': TOKEN_TYPES.ESTA_PINTADA_NEGRO,
            'estaPintadaDeRojo?': TOKEN_TYPES.ESTA_PINTADA_ROJO,
            'estaPintadaDeVerde?': TOKEN_TYPES.ESTA_PINTADA_VERDE
        };
    }
    
    // Utilidades de navegación
    current() {
        return this.source[this.pos];
    }
    
    peek(offset = 1) {
        return this.source[this.pos + offset];
    }
    
    advance() {
        const char = this.current();
        this.pos++;
        if (char === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return char;
    }
    
    isAtEnd() {
        return this.pos >= this.source.length;
    }
    
    // Predicados de caracteres
    isWhitespace(char) {
        return char === ' ' || char === '\t' || char === '\r';
    }
    
    isDigit(char) {
        return char >= '0' && char <= '9';
    }
    
    isAlpha(char) {
        return (char >= 'a' && char <= 'z') || 
               (char >= 'A' && char <= 'Z') || 
               char === '_' || char === '?';
    }
    
    isAlphaNumeric(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
    
    // Crear token
    createToken(type, value = null) {
        return {
            type,
            value,
            line: this.line,
            column: this.column
        };
    }
    
    // Saltar Espacios
    skipWhitespace() {
        while (!this.isAtEnd() && this.isWhitespace(this.current())) {
            this.advance();
        }
    }
    
    // Saltar comentarios (con soporte para comentarios anidados)
    skipComment() {
        if (this.current() === '/' && this.peek() === '*') {
            // Comentario multilínea con soporte para anidamiento
            this.advance(); // /
            this.advance(); // *
            
            let depth = 1; // Trackear profundidad de anidamiento
            
            while (!this.isAtEnd() && depth > 0) {
                // Verificar inicio de comentario anidado
                if (this.current() === '/' && this.peek() === '*') {
                    depth++;
                    this.advance(); // /
                    this.advance(); // *
                }
                // Buscar fin de comentario
                else if (this.current() === '*' && this.peek() === '/') {
                    depth--;
                    this.advance(); // *
                    this.advance(); // /
                }
                else {
                    this.advance();
                }
            }
            
            if (depth > 0) {
                throw new Error(`Línea ${this.line}: Comentario sin cerrar`);
            }
            
            return true;
        }
        return false;
    }
    
    // Tokenizar número
    tokenizeNumber() {
        const startLine = this.line;
        const startCol = this.column;
        let numStr = '';
        
        while (!this.isAtEnd() && this.isDigit(this.current())) {
            numStr += this.advance();
        }
        
        const value = parseInt(numStr, 10);
        
        // Validación de número
        if (value > 1000000) {
            throw new Error(`Línea ${startLine}: Número demasiado grande (${value})`);
        }
        
        return this.createToken(TOKEN_TYPES.NUMBER, value);
    }
    
    // Tokenizar identificador o keyword
    tokenizeIdentifier() {
        let identifier = '';
        
        while (!this.isAtEnd() && this.isAlphaNumeric(this.current())) {
            identifier += this.advance();
        }
        
        // Checkear si es una keyword
        const tokenType = this.keywords[identifier] || TOKEN_TYPES.IDENTIFIER;
        
        return this.createToken(tokenType, identifier);
    }
    
    // Tokenización principal
    tokenize() {
        this.tokens = [];
        
        while (!this.isAtEnd()) {
            this.skipWhitespace();
            
            if (this.isAtEnd()) break;
            
            // Saltar comentarios
            if (this.skipComment()) {
                continue;
            }
            
            const char = this.current();
            
            // Saltar newlines
            if (char === '\n') {
                this.advance();
                continue; // Ignoramos newlines en el tokenizer
            }
            
            // ímbolos
            if (char === '{') {
                this.tokens.push(this.createToken(TOKEN_TYPES.LBRACE, '{'));
                this.advance();
                continue;
            }
            
            if (char === '}') {
                this.tokens.push(this.createToken(TOKEN_TYPES.RBRACE, '}'));
                this.advance();
                continue;
            }
            
            if (char === '(') {
                this.tokens.push(this.createToken(TOKEN_TYPES.LPAREN, '('));
                this.advance();
                continue;
            }
            
            if (char === ')') {
                this.tokens.push(this.createToken(TOKEN_TYPES.RPAREN, ')'));
                this.advance();
                continue;
            }
            
            // Números
            if (this.isDigit(char)) {
                this.tokens.push(this.tokenizeNumber());
                continue;
            }
            
            // Identificadores y keywords
            if (this.isAlpha(char)) {
                this.tokens.push(this.tokenizeIdentifier());
                continue;
            }
            
            // Carácter desconocido
            const charCode = char.charCodeAt(0);
            const displayChar = charCode >= 32 && charCode <= 126 ? char : `\\u${charCode.toString(16).padStart(4, '0')}`;
            
            throw new Error(
                `Línea ${this.line}: Carácter inesperado '${displayChar}'.\n` +
                `Este carácter no es válido en Qdraw.\n` +
                `Caracteres válidos: letras (a-z, A-Z), números (0-9), símbolos ({, }, (, ), ?).\n` +
                `Verifica que no haya caracteres especiales o símbolos no soportados.`
            );
        }
        
        // Agregar token EOF
        this.tokens.push(this.createToken(TOKEN_TYPES.EOF, null));
        
        return this.tokens;
    }
}

// =====================================================
// PARSER (AST)
// =====================================================

class QdrawParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    
    // Utilidades de navegación
    current() {
        return this.tokens[this.pos];
    }
    
    peek(offset = 1) {
        const index = this.pos + offset;
        return index < this.tokens.length ? this.tokens[index] : this.tokens[this.tokens.length - 1];
    }
    
    advance() {
        const token = this.current();
        if (token.type !== TOKEN_TYPES.EOF) {
            this.pos++;
        }
        return token;
    }
    
    isAtEnd() {
        return this.current().type === TOKEN_TYPES.EOF;
    }
    
    // Comprobar tipo de token
    check(type) {
        return this.current().type === type;
    }
    
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                return this.advance();
            }
        }
        return null;
    }
    
    // Esperar token con mejores mensajes de error
    expect(type, message) {
        const token = this.current();
        if (token.type !== type) {
            const found = token.value || this.getTokenTypeName(token.type);
            const expected = this.getTokenTypeName(type);
            throw new Error(
                `Línea ${token.line}: Error de sintaxis.\n` +
                `Se esperaba: ${expected}\n` +
                `Se encontró: '${found}'\n` +
                `${message}`
            );
        }
        return this.advance();
    }
    
    // Obtener nombre legible del tipo de token
    getTokenTypeName(type) {
        const names = {
            [TOKEN_TYPES.LBRACE]: "'{' (llave de apertura)",
            [TOKEN_TYPES.RBRACE]: "'}' (llave de cierre)",
            [TOKEN_TYPES.LPAREN]: "'(' (paréntesis de apertura)",
            [TOKEN_TYPES.RPAREN]: "')' (paréntesis de cierre)",
            [TOKEN_TYPES.PROGRAMA]: "'programa'",
            [TOKEN_TYPES.PROCEDIMIENTO]: "'procedimiento'",
            [TOKEN_TYPES.SI]: "'si'",
            [TOKEN_TYPES.SINO]: "'sino'",
            [TOKEN_TYPES.REPETIR]: "'repetir'",
            [TOKEN_TYPES.VECES]: "'veces'",
            [TOKEN_TYPES.IDENTIFIER]: "nombre de procedimiento",
            [TOKEN_TYPES.NUMBER]: "número",
            [TOKEN_TYPES.EOF]: "fin de archivo"
        };
        return names[type] || type;
    }
    
    // Parsear programa
    parse() {
        const ast = {
            type: 'Program',
            program: null,
            procedures: []
        };
        
        while (!this.isAtEnd()) {
            if (this.check(TOKEN_TYPES.PROGRAMA)) {
                if (ast.program) {
                    throw new Error(
                        `Línea ${this.current().line}: Solo puede haber un bloque 'programa'.\n` +
                        `Ya se definió un bloque 'programa' anteriormente.\n` +
                        `Elimina el bloque duplicado.`
                    );
                }
                ast.program = this.parseProgram();
            } else if (this.check(TOKEN_TYPES.PROCEDIMIENTO)) {
                ast.procedures.push(this.parseProcedure());
            } else {
                const token = this.current();
                const found = token.value || this.getTokenTypeName(token.type);
                throw new Error(
                    `Línea ${token.line}: Elemento inesperado '${found}'.\n` +
                    `Se esperaba: 'programa' o 'procedimiento'\n` +
                    `Los archivos Qdraw deben contener:\n` +
                    `  - Un bloque 'programa { ... }' (obligatorio)\n` +
                    `  - Uno o más 'procedimiento nombre() { ... }' (opcional)`
                );
            }
        }
        
        if (!ast.program) {
            throw new Error(
                `No se encontró el bloque 'programa'.\n` +
                `Todo código Qdraw debe tener un bloque principal:\n` +
                `programa {\n` +
                `  // tu código aquí\n` +
                `}`
            );
        }
        
        return ast;
    }
    
    // Parsear bloque programa
    parseProgram() {
        const startToken = this.expect(TOKEN_TYPES.PROGRAMA, "El archivo debe comenzar con la palabra 'programa'");
        this.expect(TOKEN_TYPES.LBRACE, "Después de 'programa' debe ir '{'. Ejemplo: programa { ... }");
        
        const body = this.parseStatements();
        
        if (this.isAtEnd()) {
            throw new Error(
                `Línea ${startToken.line}: El bloque 'programa' no fue cerrado.\n` +
                `Falta una llave de cierre '}' al final.\n` +
                `Cada '{' debe tener su '}' correspondiente.`
            );
        }
        
        this.expect(TOKEN_TYPES.RBRACE, "El bloque 'programa' debe cerrarse con '}'");
        
        return {
            type: 'ProgramBlock',
            body,
            line: startToken.line
        };
    }
    
    // Parsear procedimiento
    parseProcedure() {
        const startToken = this.expect(TOKEN_TYPES.PROCEDIMIENTO, "Se esperaba la palabra 'procedimiento'");
        
        const nameToken = this.expect(
            TOKEN_TYPES.IDENTIFIER,
            "Después de 'procedimiento' debe ir un nombre.\n" +
            "Ejemplo: procedimiento miProcedimiento() { ... }"
        );
        const name = nameToken.value;
        
        this.expect(
            TOKEN_TYPES.LPAREN,
            "Después del nombre debe ir '()'.\n" +
            "Los procedimientos en Qdraw no tienen parámetros, pero los paréntesis son obligatorios.\n" +
            `Ejemplo: procedimiento ${name}() { ... }`
        );
        this.expect(
            TOKEN_TYPES.RPAREN,
            "Los procedimientos necesitan '()' aunque no tengan parámetros.\n" +
            `Ejemplo: procedimiento ${name}() { ... }`
        );
        this.expect(
            TOKEN_TYPES.LBRACE,
            "Después de '()' debe ir '{' para abrir el bloque del procedimiento.\n" +
            `Ejemplo: procedimiento ${name}() { ... }`
        );
        
        const body = this.parseStatements();
        
        if (this.isAtEnd()) {
            throw new Error(
                `Línea ${startToken.line}: El procedimiento '${name}' no fue cerrado.\n` +
                `Falta una llave de cierre '}' al final del procedimiento.\n` +
                `Cada '{' debe tener su '}' correspondiente.`
            );
        }
        
        this.expect(TOKEN_TYPES.RBRACE, `El procedimiento '${name}' debe cerrarse con '}'`);
        
        return {
            type: 'Procedure',
            name,
            body,
            line: startToken.line
        };
    }
    
    // Parsear instrucciones
    parseStatements() {
        const statements = [];
        
        while (!this.check(TOKEN_TYPES.RBRACE) && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        
        return statements;
    }
    
    // Parsear instrucción individual
    parseStatement() {
        const token = this.current();
        
        // Comandos
        if (this.match(TOKEN_TYPES.MOVER_ARRIBA)) {
            return { type: 'Command', command: 'MoverArriba', line: token.line };
        }
        if (this.match(TOKEN_TYPES.MOVER_ABAJO)) {
            return { type: 'Command', command: 'MoverAbajo', line: token.line };
        }
        if (this.match(TOKEN_TYPES.MOVER_DERECHA)) {
            return { type: 'Command', command: 'MoverDerecha', line: token.line };
        }
        if (this.match(TOKEN_TYPES.MOVER_IZQUIERDA)) {
            return { type: 'Command', command: 'MoverIzquierda', line: token.line };
        }
        if (this.match(TOKEN_TYPES.PINTAR_NEGRO)) {
            return { type: 'Command', command: 'PintarNegro', line: token.line };
        }
        if (this.match(TOKEN_TYPES.PINTAR_ROJO)) {
            return { type: 'Command', command: 'PintarRojo', line: token.line };
        }
        if (this.match(TOKEN_TYPES.PINTAR_VERDE)) {
            return { type: 'Command', command: 'PintarVerde', line: token.line };
        }
        if (this.match(TOKEN_TYPES.LIMPIAR)) {
            return { type: 'Command', command: 'Limpiar', line: token.line };
        }
        
        // Repetir
        if (this.match(TOKEN_TYPES.REPETIR)) {
            return this.parseRepetir(token.line);
        }
        
        // Si
        if (this.match(TOKEN_TYPES.SI)) {
            return this.parseSi(token.line);
        }
        
        // Llamada a procedimiento
        if (this.check(TOKEN_TYPES.IDENTIFIER)) {
            return this.parseProcedureCall();
        }
        
        const found = token.value || this.getTokenTypeName(token.type);
        throw new Error(
            `Línea ${token.line}: Instrucción no reconocida '${found}'.\n` +
            `Instrucciones válidas:\n` +
            `  - Movimiento: MoverArriba, MoverAbajo, MoverDerecha, MoverIzquierda\n` +
            `  - Dibujo: PintarNegro, PintarRojo, PintarVerde, Limpiar\n` +
            `  - Control: repetir N veces { ... }, si(...) { ... } sino { ... }\n` +
            `  - Llamadas: nombreProcedimiento()`
        );
    }
    
    // Parsear repetir
    parseRepetir(line) {
        const countToken = this.expect(
            TOKEN_TYPES.NUMBER,
            "Después de 'repetir' debe ir un número.\n" +
            "Ejemplo: repetir 10 veces { ... }"
        );
        this.expect(
            TOKEN_TYPES.VECES,
            "Después del número debe ir la palabra 'veces'.\n" +
            `Ejemplo: repetir ${countToken.value} veces { ... }`
        );
        this.expect(
            TOKEN_TYPES.LBRACE,
            "Después de 'veces' debe ir '{' para abrir el bloque.\n" +
            `Ejemplo: repetir ${countToken.value} veces { MoverArriba }`
        );
        
        const body = this.parseStatements();
        
        if (this.isAtEnd()) {
            throw new Error(
                `Línea ${line}: El bloque 'repetir' no fue cerrado.\n` +
                `Falta una llave de cierre '}' al final.\n` +
                `Cada '{' debe tener su '}' correspondiente.`
            );
        }
        
        this.expect(TOKEN_TYPES.RBRACE, "El bloque 'repetir' debe cerrarse con '}'");
        
        return {
            type: 'Repetir',
            count: countToken.value,
            body,
            line
        };
    }
    
    // Parsear si
    parseSi(line) {
        this.expect(
            TOKEN_TYPES.LPAREN,
            "Después de 'si' debe ir '(' para abrir la condición.\n" +
            "Ejemplo: si(HayBolita) { ... }"
        );
        const condition = this.parseCondition();
        this.expect(
            TOKEN_TYPES.RPAREN,
            "Después de la condición debe ir ')' para cerrarla.\n" +
            "Ejemplo: si(HayBolita) { ... }"
        );
        this.expect(
            TOKEN_TYPES.LBRACE,
            "Después de ')' debe ir '{' para abrir el bloque.\n" +
            "Ejemplo: si(HayBolita) { PintarRojo }"
        );
        
        const thenBody = this.parseStatements();
        
        if (this.isAtEnd()) {
            throw new Error(
                `Línea ${line}: El bloque 'si' no fue cerrado.\n` +
                `Falta una llave de cierre '}' al final.\n` +
                `Cada '{' debe tener su '}' correspondiente.`
            );
        }
        
        this.expect(TOKEN_TYPES.RBRACE, "El bloque 'si' debe cerrarse con '}'");
        
        let elseBody = null;
        if (this.match(TOKEN_TYPES.SINO)) {
            this.expect(
                TOKEN_TYPES.LBRACE,
                "Después de 'sino' debe ir '{' para abrir el bloque.\n" +
                "Ejemplo: sino { PintarNegro }"
            );
            elseBody = this.parseStatements();
            
            if (this.isAtEnd()) {
                throw new Error(
                    `Línea ${line}: El bloque 'sino' no fue cerrado.\n` +
                    `Falta una llave de cierre '}' al final.`
                );
            }
            
            this.expect(TOKEN_TYPES.RBRACE, "El bloque 'sino' debe cerrarse con '}'");
        }
        
        return {
            type: 'Si',
            condition,
            thenBody,
            elseBody,
            line
        };
    }
    
    // Parsear condición (sensor)
    parseCondition() {
        const token = this.current();
        
        if (this.match(TOKEN_TYPES.ESTA_VACIA)) {
            return { type: 'Sensor', sensor: 'estaVacia?', line: token.line };
        }
        if (this.match(TOKEN_TYPES.ESTA_PINTADA_NEGRO)) {
            return { type: 'Sensor', sensor: 'estaPintadaDeNegro?', line: token.line };
        }
        if (this.match(TOKEN_TYPES.ESTA_PINTADA_ROJO)) {
            return { type: 'Sensor', sensor: 'estaPintadaDeRojo?', line: token.line };
        }
        if (this.match(TOKEN_TYPES.ESTA_PINTADA_VERDE)) {
            return { type: 'Sensor', sensor: 'estaPintadaDeVerde?', line: token.line };
        }
        
        const found = token.value || this.getTokenTypeName(token.type);
        throw new Error(
            `Línea ${token.line}: Condición no válida '${found}'.\n` +
            `Las condiciones válidas (sensores) son:\n` +
            `  - estaVacia?\n` +
            `  - estaPintadaDeNegro?\n` +
            `  - estaPintadaDeRojo?\n` +
            `  - estaPintadaDeVerde?\n` +
            `Ejemplo: si(estaVacia?) { PintarRojo }`
        );
    }
    
    // Parsear llamada a procedimiento
    parseProcedureCall() {
        const nameToken = this.expect(
            TOKEN_TYPES.IDENTIFIER,
            "Se esperaba el nombre de un procedimiento definido previamente"
        );
        this.expect(
            TOKEN_TYPES.LPAREN,
            `Después del nombre '${nameToken.value}' debe ir '('.\n` +
            "Los procedimientos siempre se llaman con paréntesis.\n" +
            `Ejemplo: ${nameToken.value}()`
        );
        this.expect(
            TOKEN_TYPES.RPAREN,
            "Los procedimientos no tienen parámetros, debe ir ')'.\n" +
            `Ejemplo: ${nameToken.value}()`
        );
        
        return {
            type: 'ProcedureCall',
            name: nameToken.value,
            line: nameToken.line
        };
    }
}

// =====================================================
// INTERPRETE (ESTADO DEL TABLERO)
// =====================================================

class QdrawInterpreter {
    constructor(width, height) {
        this.validateBoardSize(width, height);
        
        this.width = width;
        this.height = height;
        this.grid = this.createGrid();
        this.headX = 0;
        this.headY = 0;
        this.state = 'editing'; // editando, ejecutando, terminado, error
        this.speed = 3; // Velocidad por defecto
    }
    
    validateBoardSize(width, height) {
        if (width < QDRAW_CONFIG.MIN_BOARD_SIZE || width > QDRAW_CONFIG.MAX_BOARD_SIZE) {
            throw new Error(`Ancho inválido: debe estar entre ${QDRAW_CONFIG.MIN_BOARD_SIZE} y ${QDRAW_CONFIG.MAX_BOARD_SIZE}`);
        }
        if (height < QDRAW_CONFIG.MIN_BOARD_SIZE || height > QDRAW_CONFIG.MAX_BOARD_SIZE) {
            throw new Error(`Alto inválido: debe estar entre ${QDRAW_CONFIG.MIN_BOARD_SIZE} y ${QDRAW_CONFIG.MAX_BOARD_SIZE}`);
        }
    }
    
    createGrid() {
        return Array(this.height).fill(null).map(() => Array(this.width).fill(null));
    }
    
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    getCellColor(x, y) {
        if (!this.isValidPosition(x, y)) return null;
        return this.grid[y][x];
    }
    
    setCellColor(x, y, color) {
        if (!this.isValidPosition(x, y)) {
            throw new Error(`Posición inválida: (${x}, ${y})`);
        }
        this.grid[y][x] = color;
    }
    
    getHeadPosition() {
        return { x: this.headX, y: this.headY };
    }
    
    // Commands
    moverArriba() {
        const newY = this.headY + 1;
        if (!this.isValidPosition(this.headX, newY)) {
            throw new Error(`BOOM: El cabezal se salió del tablero intentando mover arriba desde (${this.headX}, ${this.headY})`);
        }
        this.headY = newY;
    }
    
    moverAbajo() {
        const newY = this.headY - 1;
        if (!this.isValidPosition(this.headX, newY)) {
            throw new Error(`BOOM: El cabezal se salió del tablero intentando mover abajo desde (${this.headX}, ${this.headY})`);
        }
        this.headY = newY;
    }
    
    moverDerecha() {
        const newX = this.headX + 1;
        if (!this.isValidPosition(newX, this.headY)) {
            throw new Error(`BOOM: El cabezal se salió del tablero intentando mover derecha desde (${this.headX}, ${this.headY})`);
        }
        this.headX = newX;
    }
    
    moverIzquierda() {
        const newX = this.headX - 1;
        if (!this.isValidPosition(newX, this.headY)) {
            throw new Error(`BOOM: El cabezal se salió del tablero intentando mover izquierda desde (${this.headX}, ${this.headY})`);
        }
        this.headX = newX;
    }
    
    pintarNegro() {
        this.setCellColor(this.headX, this.headY, COLORS.NEGRO);
    }
    
    pintarRojo() {
        this.setCellColor(this.headX, this.headY, COLORS.ROJO);
    }
    
    pintarVerde() {
        this.setCellColor(this.headX, this.headY, COLORS.VERDE);
    }
    
    limpiar() {
        this.setCellColor(this.headX, this.headY, COLORS.EMPTY);
    }
    
    // Sensors
    estaVacia() {
        return this.getCellColor(this.headX, this.headY) === null;
    }
    
    estaPintadaDeNegro() {
        return this.getCellColor(this.headX, this.headY) === COLORS.NEGRO;
    }
    
    estaPintadaDeRojo() {
        return this.getCellColor(this.headX, this.headY) === COLORS.ROJO;
    }
    
    estaPintadaDeVerde() {
        return this.getCellColor(this.headX, this.headY) === COLORS.VERDE;
    }
    
    // Teletransportar (para edición en UI)
    teleport(x, y) {
        if (!this.isValidPosition(x, y)) return false;
        this.headX = x;
        this.headY = y;
        return true;
    }
    
    // Reiniciar
    reset() {
        this.grid = this.createGrid();
        this.headX = 0;
        this.headY = 0;
        this.state = 'editing';
    }
    
    // Clonar estado
    cloneState() {
        return {
            grid: JSON.parse(JSON.stringify(this.grid)),
            headX: this.headX,
            headY: this.headY
        };
    }
    
    // Restaurar estado
    restoreState(state) {
        this.grid = JSON.parse(JSON.stringify(state.grid));
        this.headX = state.headX;
        this.headY = state.headY;
    }
}

// =====================================================
// EJECUTOR (RUNTIME)
// =====================================================

class QdrawExecutor {
    constructor(interpreter, ast, onStep = null) {
        this.interpreter = interpreter;
        this.ast = ast;
        this.onStep = onStep;
        this.procedures = new Map();
        this.stepCount = 0;
        this.callStack = [];
        this.cancelled = false;
        
        // Registrar procedimientos
        for (const proc of ast.procedures) {
            if (this.procedures.has(proc.name)) {
                const firstDef = this.procedures.get(proc.name);
                throw new Error(
                    `Línea ${proc.line}: Procedimiento '${proc.name}' ya fue definido.\n` +
                    `Primera definición: línea ${firstDef.line}\n` +
                    `Cada procedimiento debe tener un nombre único.\n` +
                    `Cambia el nombre de uno de los dos procedimientos.`
                );
            }
            this.procedures.set(proc.name, proc);
        }
    }
    
    async execute(speed = 3) {
        this.stepCount = 0;
        this.callStack = [];
        
        try {
            await this.executeBlock(this.ast.program.body, this.ast.program.line);
            return {
                success: true,
                message: `Ejecución completada con éxito (${this.stepCount} pasos)`
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    async executeBlock(statements, blockLine) {
        for (const stmt of statements) {
            // Check if execution was cancelled
            if (this.cancelled) {
                throw new Error('Ejecución detenida por el usuario');
            }
            
            await this.executeStatement(stmt);
            
            // Check step limit
            if (this.stepCount > QDRAW_CONFIG.MAX_EXECUTION_STEPS) {
                throw new Error(
                    `Límite de ejecución excedido (${QDRAW_CONFIG.MAX_EXECUTION_STEPS} pasos).\n` +
                    `Posible bucle infinito o programa muy largo.\n` +
                    `Verifica tus ciclos 'repetir' y llamadas recursivas.`
                );
            }
        }
    }
    
    async executeStatement(stmt) {
        this.stepCount++;
        
        switch (stmt.type) {
            case 'Command':
                await this.executeCommand(stmt);
                break;
            case 'ProcedureCall':
                await this.executeProcedureCall(stmt);
                break;
            case 'Repetir':
                await this.executeRepetir(stmt);
                break;
            case 'Si':
                await this.executeSi(stmt);
                break;
            default:
                throw new Error(`Línea ${stmt.line}: Tipo de instrucción desconocida '${stmt.type}'`);
        }
    }
    
    async executeCommand(stmt) {
        try {
            switch (stmt.command) {
                case 'MoverArriba':
                    this.interpreter.moverArriba();
                    break;
                case 'MoverAbajo':
                    this.interpreter.moverAbajo();
                    break;
                case 'MoverDerecha':
                    this.interpreter.moverDerecha();
                    break;
                case 'MoverIzquierda':
                    this.interpreter.moverIzquierda();
                    break;
                case 'PintarNegro':
                    this.interpreter.pintarNegro();
                    break;
                case 'PintarRojo':
                    this.interpreter.pintarRojo();
                    break;
                case 'PintarVerde':
                    this.interpreter.pintarVerde();
                    break;
                case 'Limpiar':
                    this.interpreter.limpiar();
                    break;
                default:
                    throw new Error(`Comando desconocido: ${stmt.command}`);
            }
            
            if (this.onStep) {
                this.onStep();
            }
            
            await this.delay();
            
        } catch (error) {
            // Add line number to BOOM errors
            if (error.message.includes('BOOM')) {
                throw new Error(`Línea ${stmt.line}: ${error.message}`);
            }
            throw new Error(`Línea ${stmt.line}: ${error.message}`);
        }
    }
    
    async executeProcedureCall(stmt) {
        const proc = this.procedures.get(stmt.name);
        
        if (!proc) {
            const available = Array.from(this.procedures.keys());
            const suggestions = available.length > 0 
                ? `\nProcedimientos disponibles: ${available.join(', ')}`
                : '\nNo hay procedimientos definidos.';
            
            throw new Error(
                `Línea ${stmt.line}: Procedimiento '${stmt.name}' no existe.${suggestions}\n` +
                `Asegúrate de:\n` +
                `  1. Definir el procedimiento antes de usarlo\n` +
                `  2. Escribir el nombre exactamente igual (mayúsculas/minúsculas importan)\n` +
                `  3. Llamarlo con paréntesis: ${stmt.name}()`
            );
        }
        
        // Verificar profundidad de recursión
        if (this.callStack.length >= QDRAW_CONFIG.MAX_RECURSION_DEPTH) {
            throw new Error(
                `Línea ${stmt.line}: Profundidad de recursión excedida en '${stmt.name}'.\n` +
                `Has llamado procedimientos anidados demasiadas veces (límite: ${QDRAW_CONFIG.MAX_RECURSION_DEPTH}).\n` +
                `Pila de llamadas: ${this.callStack.join(' → ')} → ${stmt.name}`
            );
        }
        
        this.callStack.push(stmt.name);
        
        try {
            await this.executeBlock(proc.body, proc.line);
        } finally {
            this.callStack.pop();
        }
    }
    
    async executeRepetir(stmt) {
        if (stmt.count < 0) {
            throw new Error(
                `Línea ${stmt.line}: El número de repeticiones no puede ser negativo (${stmt.count}).\n` +
                `Usa un número positivo: repetir 10 veces { ... }`
            );
        }
        
        if (stmt.count > 10000) {
            throw new Error(
                `Línea ${stmt.line}: Demasiadas repeticiones (${stmt.count}).\n` +
                `El límite es 10000 para evitar bloqueos.\n` +
                `Si necesitas más iteraciones, verifica tu lógica.`
            );
        }
        
        for (let i = 0; i < stmt.count; i++) {
            await this.executeBlock(stmt.body, stmt.line);
        }
    }
    
    async executeSi(stmt) {
        const conditionResult = this.evaluateCondition(stmt.condition);
        
        if (conditionResult) {
            await this.executeBlock(stmt.thenBody, stmt.line);
        } else if (stmt.elseBody) {
            await this.executeBlock(stmt.elseBody, stmt.line);
        }
    }
    
    evaluateCondition(condition) {
        switch (condition.sensor) {
            case 'estaVacia?':
                return this.interpreter.estaVacia();
            case 'estaPintadaDeNegro?':
                return this.interpreter.estaPintadaDeNegro();
            case 'estaPintadaDeRojo?':
                return this.interpreter.estaPintadaDeRojo();
            case 'estaPintadaDeVerde?':
                return this.interpreter.estaPintadaDeVerde();
            default:
                throw new Error(`Línea ${condition.line}: Sensor desconocido '${condition.sensor}'`);
        }
    }
    
    delay() {
        const delays = QDRAW_CONFIG.ANIMATION_DELAYS;
        const speed = this.interpreter.speed || 3;
        
        let ms;
        if (speed === 0 || speed === '0') {
            ms = delays.INSTANT;
        } else if (speed === 1 || speed === '1') {
            ms = delays.SLOW;
        } else if (speed === 3 || speed === '3') {
            ms = delays.NORMAL;
        } else if (speed === 7 || speed === '7') {
            ms = delays.FAST;
        } else {
            ms = delays.NORMAL;
        }
        
        if (ms === 0) return Promise.resolve();
        
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    cancel() {
        this.cancelled = true;
    }
}

// =====================================================
// EXPORTACIONES
// =====================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QdrawTokenizer,
        QdrawParser,
        QdrawInterpreter,
        QdrawExecutor,
        QDRAW_CONFIG,
        TOKEN_TYPES,
        COLORS
    };
}
