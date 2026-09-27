# Rediseño completo del Frontend — Auditoría UX + Reconstrucción

Quiero que actúes como un **Product Designer senior + UX Engineer + Frontend Architect**, con criterio de alguien que ha diseñado productos digitales excelentes y que no tiene miedo de tirar a la basura una interfaz mediocre.

## MISIÓN

Necesito que **REHAGAS COMPLETAMENTE EL FRONTEND DE ESTA APLICACIÓN**.

La interfaz actual tiene una experiencia de usuario deficiente. No quiero que la “embellezcas”, ni que simplemente cambies colores, márgenes, botones o tipografías.

Quiero que **olvides mentalmente cómo está construida actualmente la interfaz** y la analices como si te hubieran entregado únicamente el sistema, sus reglas de negocio y sus usuarios.

Tu objetivo no es conservar el diseño actual.

Tu objetivo es preguntarte:

> **“Si yo tuviera que diseñar esta aplicación hoy desde cero para que un usuario pueda hacer su trabajo de la manera más simple, rápida, clara e intuitiva posible, ¿cómo la construiría?”**

Y después hacerlo.

---

# 1. PRIMERO: ENTENDER EL PRODUCTO

Antes de modificar código, inspeccioná profundamente el proyecto.

Analizá:

- Todas las pantallas existentes.
- Rutas.
- Componentes.
- Formularios.
- Tablas.
- Modales.
- Filtros.
- Navegación.
- Flujos.
- Permisos.
- Estados.
- Validaciones.
- Mensajes.
- Lógica de negocio.
- APIs.
- Datos que consume cada pantalla.
- Acciones que puede realizar el usuario.
- Dependencias entre módulos.

**NO empieces programando.**

Primero construí mentalmente el modelo de la aplicación.

Quiero que identifiques qué intenta hacer el usuario realmente, no simplemente qué botones existen actualmente.

Por ejemplo:

No pienses:

> “El usuario tiene un botón que dice Crear.”

Pensá:

> “El usuario necesita registrar X, probablemente necesita determinados datos, después necesita verificar Y y finalmente necesita obtener Z.”

La lógica de negocio es la fuente de verdad.

---

# 2. OLVIDATE DEL FRONT ACTUAL

Quiero que seas brutalmente crítico con la interfaz existente.

No asumas que algo debe mantenerse simplemente porque ya existe.

Preguntate para cada elemento:

- ¿Esto realmente le sirve al usuario?
- ¿Es necesario?
- ¿Está en el lugar correcto?
- ¿El usuario entiende qué hacer sin explicación?
- ¿La jerarquía visual tiene sentido?
- ¿Hay demasiados pasos?
- ¿Hay información irrelevante ocupando espacio?
- ¿Hay acciones escondidas?
- ¿El usuario sabe dónde está?
- ¿El sistema comunica claramente qué acaba de suceder?
- ¿Hay pantallas que podrían convertirse en una sola experiencia?
- ¿Hay formularios que podrían simplificarse?
- ¿Hay tablas que muestran demasiada información?
- ¿Hay información que debería aparecer solamente cuando es necesaria?

Si encontrás una solución mucho mejor que la actual, **implementala aunque implique modificar completamente la estructura visual.**

No quiero un “lavado de cara”.

Quiero una **reconstrucción conceptual del producto**.

---

# 3. DISEÑÁ PARA EL USUARIO, NO PARA EL SISTEMA

El usuario no debería tener que entender cómo funciona nuestra base de datos, nuestros endpoints o nuestra arquitectura.

La aplicación tiene que traducir la complejidad interna en una experiencia sencilla.

Si internamente existen:

- 15 campos
- 4 tablas
- 3 estados
- 7 endpoints
- múltiples relaciones

eso NO significa que el usuario tenga que ver 15 campos, 4 tablas, 3 estados y 7 acciones.

Quiero que diseñes la experiencia desde la perspectiva:

> **“¿Qué necesita saber y hacer el usuario en este momento?”**

No desde:

> “¿Qué datos tenemos disponibles?”

---

# 4. BUSCÁ LA EXPERIENCIA IDEAL

Quiero que pienses como si tuvieras libertad absoluta para rediseñar la aplicación.

Buscá:

### Menos fricción

Menos clicks.  
Menos decisiones innecesarias.  
Menos campos.  
Menos pantallas.  
Menos confusión.

### Más claridad

El usuario debe entender:

- dónde está,
- qué está viendo,
- qué puede hacer,
- qué debería hacer después,
- qué ocurrió después de una acción.

### Mejor jerarquía

No todo puede tener la misma importancia.

La interfaz debe decir visualmente:

**“Esto es lo importante.”**

**“Esto es secundario.”**

**“Esto solamente lo necesitás si ocurre determinada situación.”**

### Mejor navegación

Quiero que el usuario pueda recorrer el sistema casi intuitivamente.

Si necesito explicarle cómo usar una pantalla, probablemente la pantalla está mal diseñada.

---

# 5. NO TE LIMITES A COPIAR PATRONES

Quiero creatividad.

No quiero que simplemente conviertas todo en:

- sidebar
- navbar
- cards
- tablas
- modales
- botones azules

porque eso es lo fácil.

Buscá patrones de productos modernos cuando tengan sentido, pero adaptalos al problema.

Podés proponer:

- dashboards contextuales
- búsquedas inteligentes
- filtros dinámicos
- progressive disclosure
- formularios por etapas
- acciones contextuales
- estados visuales
- timelines
- vistas resumidas + detalle
- navegación contextual
- comandos rápidos
- empty states útiles
- feedback inmediato
- shortcuts
- agrupación inteligente
- acciones bulk
- paneles laterales
- vistas split-screen
- información contextual
- asistentes de flujo
- confirmaciones inteligentes
- autosave cuando corresponda
- breadcrumbs solamente si aportan valor
- cualquier patrón que mejore realmente la experiencia.

Pero **NO agregues features porque sí**.

Cada decisión debe responder:

> “¿Esto hace que el usuario complete mejor su trabajo?”

---

# 6. DISEÑÁ LOS FLUJOS, NO SOLAMENTE LAS PANTALLAS

Esto es muy importante.

No quiero que cada pantalla sea diseñada aisladamente.

Pensá en los recorridos completos.

Por ejemplo:

**Entrar → encontrar información → analizar → tomar decisión → ejecutar acción → confirmar resultado → continuar trabajando.**

La experiencia debe sentirse como una historia continua.

Evitá que el usuario sienta:

> “Ahora estoy en otra pantalla y no sé cómo llegué acá.”

---

# 7. LA INTERFAZ DEBE SER INTELIGENTE

Cuando sea posible, la aplicación debería anticiparse al usuario.

Ejemplos:

Si una acción normalmente requiere determinada información, intentá facilitarla.

Si un filtro es utilizado constantemente, hacelo accesible.

Si un estado determina qué acciones son posibles, mostrale al usuario únicamente las acciones relevantes.

Si una información ya está disponible, no se la vuelvas a pedir.

Si una acción tiene consecuencias importantes, comunicalas claramente.

Si algo no puede hacerse, explicá por qué.

Si algo acaba de ocurrir, hacé evidente el resultado.

La aplicación debería sentirse como una herramienta que **ayuda al usuario**, no como un formulario que le exige información.

---

# 8. TABLAS, FORMULARIOS Y DATOS

Prestá especial atención a esto.

No quiero:

> “Una tabla con 25 columnas porque la base de datos tiene 25 campos.”

Quiero que determines:

- qué información necesita ver primero,
- qué puede estar oculta,
- qué puede aparecer al seleccionar un registro,
- qué merece una vista de detalle,
- qué acciones son contextuales,
- qué filtros realmente importan,
- qué información puede resumirse.

Lo mismo con formularios.

Si un formulario tiene 20 campos, cuestioná si realmente tienen que aparecer los 20 al mismo tiempo.

---

# 9. ESTADOS Y FEEDBACK

Diseñá explícitamente:

- loading
- empty state
- error
- success
- warning
- disabled
- permisos insuficientes
- sin resultados
- guardado
- procesamiento
- estados parciales
- estados de transición

Nunca dejes al usuario preguntándose:

> “¿Funcionó?”

> “¿Está cargando?”

> “¿Qué tengo que hacer ahora?”

---

# 10. DISEÑO VISUAL

Quiero una interfaz moderna, profesional y coherente.

No busco “más colores”.

Busco:

- excelente jerarquía visual,
- buen uso del espacio,
- tipografía clara,
- contraste correcto,
- componentes consistentes,
- estados visuales claros,
- espaciado coherente,
- iconografía funcional,
- densidad de información adecuada,
- responsive design,
- accesibilidad.

El diseño debe sentirse como un **producto profesional**, no como un conjunto de pantallas administrativas ensambladas.

---

# 11. CONSERVÁ LA LÓGICA DE NEGOCIO

IMPORTANTE:

**No rompas la lógica existente.**

El backend, APIs, reglas de negocio y comportamiento funcional deben mantenerse salvo que sea estrictamente necesario modificarlos.

El objetivo principal es reconstruir la **experiencia y presentación del producto**.

Si detectás algo de la lógica que parece contradictorio, confuso o problemático, no lo inventes ni lo cambies arbitrariamente.

Documentá la observación.

---

# 12. ANTES DE PROGRAMAR

Primero quiero que hagas una auditoría del producto.

Entregame un análisis breve con:

### A. Qué hace realmente la aplicación

### B. Quiénes son sus usuarios

### C. Cuáles son las tareas principales

### D. Cuáles son los principales problemas UX actuales

### E. Qué partes del frontend deberían descartarse conceptualmente

### F. Qué arquitectura de navegación proponés

### G. Cuáles serían los principales flujos ideales

### H. Qué pantallas/componentes proponés

### I. Qué decisiones de UX son las más importantes

No quiero una explicación académica interminable.

Quiero criterio.

---

# 13. DESPUÉS: IMPLEMENTACIÓN

Una vez analizado el producto, implementá el rediseño.

No quiero que esperes que yo te diga:

> “Ahora hacé el menú.”

> “Ahora la tabla.”

> “Ahora el formulario.”

Quiero que tomes decisiones.

Si para lograr una mejor experiencia necesitás reorganizar componentes, rutas visuales, layouts o estructura del frontend, hacelo.

Priorizá:

1. Flujo principal del usuario.
2. Navegación.
3. Jerarquía de información.
4. Acciones principales.
5. Formularios.
6. Tablas y búsqueda.
7. Estados y feedback.
8. Detalles visuales.

---

# 14. REGLA FUNDAMENTAL

Cada vez que estés por conservar algo del frontend actual, preguntate:

> **“¿Lo mantengo porque es realmente bueno o porque ya estaba hecho?”**

Si la respuesta es la segunda:

**REPLANTEALO.**

No tengas apego al código ni al diseño existente.

---

# 15. TU OBJETIVO FINAL

Quiero que cuando una persona utilice la aplicación por primera vez piense:

> **“Ah, entiendo.”**

Y después:

> **“Esto es fácil.”**

Y después:

> **“¿Ya está? ¿Eso era todo?”**

Ese es el resultado que busco.

No quiero una aplicación que solamente **funcione**.

Quiero una aplicación que **dé gusto usar**.

Y quiero que el rediseño nazca de entender profundamente **qué intenta conseguir el usuario**, no de intentar decorar lo que ya existe.

**Primero analizá. Después proponé. Después construí.**

No tengas miedo de ser creativo.
