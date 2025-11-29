# Intérprete Qdraw

Intérprete moderno del lenguaje de programación educativo **Qdraw** con editor Monaco, desarrollado para la Universidad Nacional de Quilmes.

**Demo en vivo:** [francoaranda.com/tools/qdraw](https://francoaranda.com/tools/qdraw)

---

## ¿Qué es esto?

Qdraw es un lenguaje educativo para aprender programación dibujando en un tablero. Este proyecto es un intérprete web completo que incluye:

- Editor de código con Monaco (el de VS Code)
- Visualización en tiempo real de la ejecución
- Mensajes de error claros y útiles
- Exportación/importación de archivos .qdraw

---

## Instalación

### Opción 1: Usar online

Directamente en: [francoaranda.com/tools/qdraw](https://francoaranda.com/tools/qdraw)

### Opción 2: Correr localmente

```bash
git clone https://github.com/Reader10/Interprete-Qdraw.git
cd Interprete-Qdraw

# Con Python
python -m http.server 8000

# O con Node
npx http-server -p 8000
```

Abrir en el navegador: `http://localhost:8000`

---

## Uso básico

Ejemplo simple:

```qdraw
programa {
    repetir 5 veces {
        PintarRojo
        MoverDerecha
    }
}
```

Configura el tablero en 10x10, dale a Ejecutar y listo.

---

## Sintaxis

### Comandos básicos

**Movimiento:**
- `MoverArriba`, `MoverAbajo`, `MoverDerecha`, `MoverIzquierda`

**Pintura:**
- `PintarNegro`, `PintarRojo`, `PintarVerde`, `Limpiar`

### Estructuras de control

**Repetir:**
```qdraw
repetir 10 veces {
    MoverDerecha
}
```

**Condicionales:**
```qdraw
si (estaVacia?) {
    PintarRojo
} sino {
    Limpiar
}
```

**Sensores disponibles:**
- `estaVacia?`
- `estaPintadaDeNegro?`
- `estaPintadaDeRojo?`
- `estaPintadaDeVerde?`

### Procedimientos

```qdraw
procedimiento DibujarLinea() {
    repetir 5 veces {
        PintarRojo
        MoverDerecha
    }
}

programa {
    DibujarLinea()
    MoverAbajo
    DibujarLinea()
}
```

### Comentarios

```qdraw
/* Comentario simple */

/* Los comentarios se pueden anidar
   /* como esto */
   sin problemas */
```

---

## Controles

**Tablero:**
- Click en una celda: cambia su color
- Shift + Click: mueve el cabezal ahí

**Botones:**
- Ejecutar: corre el programa
- Detener: cancela la ejecución
- Reset: vuelve al estado inicial
- Guardar/Abrir: exporta e importa archivos .qdraw

**Velocidades:**
- Instantáneo, Rápido, Normal, Lento

---

## Límites y seguridad

- Máximo 100,000 pasos de ejecución
- Recursión limitada a 1000 niveles
- Tableros de 1x1 hasta 50x50
- Archivos de hasta 500KB
- Solo acepta extensiones .qdraw y .txt
- Parser manual sin eval(), completamente seguro

---

## Archivos del proyecto

```
index.html          - Página principal
styles.css          - Estilos
interpreter.js      - Motor del intérprete (tokenizer, parser, executor)
app.js              - Interfaz con Monaco Editor
```
---

## Compatibilidad

Funciona en Chrome, Firefox, Safari, Edge y Opera (versiones modernas).

---

## Contribuir

Si encontrás un bug o querés proponer algo, abrí un issue en [GitHub](https://github.com/Reader10/Interprete-Qdraw/issues).

---

## Licencia

MIT - ver archivo [LICENSE](LICENSE)

---

**Autor:** Franco Aranda  
**Web:** [francoaranda.com](https://francoaranda.com)  
**GitHub:** [@Reader10](https://github.com/Reader10)

Proyecto educativo - Universidad Nacional de Quilmes
