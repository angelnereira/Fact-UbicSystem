# Fact-UbicSystem: Documentación Técnica

**Fact-UbicSystem** es una aplicación web que funciona como un puente de integración para la facturación electrónica con el sistema de **The Factory HKA (FEL Panamá)**. Permite gestionar, monitorear y automatizar el proceso de timbrado, consulta y anulación de facturas electrónicas de múltiples clientes desde una única interfaz.

---

## 1. Arquitectura General

La aplicación sigue una arquitectura **Backend-for-Frontend (BFF)**, diseñada para ser segura, escalable y mantenible.

-   **Frontend (Cliente)**: Es una Single-Page Application (SPA) construida con Next.js y React. Se encarga de toda la interfaz de usuario, la gestión del estado local y las interacciones del usuario. No se comunica directamente con la API de HKA por razones de seguridad.
-   **Backend (API Routes de Next.js)**: Actúa como una capa intermedia segura. La interfaz de usuario envía solicitudes a estos endpoints (ej: `/api/hka/timbrar`). Estos, a su vez, ejecutan la lógica de negocio en el servidor, como cargar credenciales desde Firestore y comunicarse con la API de HKA. Esto evita exponer credenciales o tokens en el navegador.
-   **Servicios Externos**:
    -   **Firebase**: Provee la base de datos (Firestore) para almacenar configuraciones y logs, y el servicio de autenticación para gestionar usuarios.
    -   **API de HKA**: El servicio REST externo para todas las operaciones de facturación electrónica.

 
*Diagrama conceptual de la arquitectura.*

---

## 2. Stack Tecnológico

-   **Framework**: **Next.js 15** con **App Router**.
-   **Lenguaje**: **TypeScript**.
-   **UI y Estilos**:
    -   **React 18**: Para la construcción de la interfaz.
    -   **ShadCN UI**: Componentes reutilizables y accesibles (Cards, Buttons, Inputs, etc.).
    -   **Tailwind CSS**: Para un estilizado rápido y consistente.
    -   **Lucide React**: Biblioteca de iconos.
-   **Backend y Base de Datos**:
    -   **Firebase Firestore**: Base de datos NoSQL para almacenar:
        -   `/configurations`: Perfiles de clientes HKA (credenciales, RUC, etc.).
        -   `/invoiceSubmissions`: Logs de todas las facturas enviadas.
        -   `/hkaResponses`: Logs de las respuestas de HKA.
        -   `/users`: Perfiles de los usuarios de la plataforma.
    -   **Firebase Authentication**: Para el inicio y cierre de sesión con email y contraseña.
-   **Formularios**:
    -   **React Hook Form**: Para una gestión eficiente y performante de los formularios.
    -   **Zod**: Para la validación de esquemas de datos.

---

## 3. Componentes Clave y su Función

### 3.1. Lógica de Negocio (`src/lib/hka`)

-   `actions.ts`: **El núcleo de la integración**. Contiene las funciones del lado del servidor que interactúan con la API de HKA.
    -   `getHkaCredentials()`: Carga de forma segura la configuración de un cliente desde Firestore usando su `configId`.
    -   `getAuthToken()`: Se conecta a `/api/Autenticacion` de HKA, obtiene un token JWT y lo cachea.
    -   `hkaApiRequest()`: Función centralizada que realiza las llamadas `fetch` a HKA, inyectando el token de autenticación.
    -   `timbrar()`, `consultarEstado()`, `anular()`, `consultarFolios()`: Exportan la funcionalidad de negocio al resto de la aplicación.

-   `types.ts`: Define las interfaces de TypeScript (ej: `HkaError`, `HkaStatus`) para un tipado estricto en toda la aplicación.

### 3.2. Endpoints de API (`src/app/api`)

Estos endpoints son la puerta de entrada desde el cliente hacia el servidor.

-   `/api/hka/timbrar`: Recibe los datos de la factura desde la UI, llama a la acción `timbrar()` y persiste el resultado en Firestore.
-   `/api/hka/validate`: Recibe credenciales de `usuario` y `clave` desde la UI y llama a `validateCredentials()` para probar la conexión con HKA.
-   `/api/webhooks/invoices/[identifier]`: **Endpoint de automatización**. Recibe facturas de sistemas externos, busca la configuración del cliente por su `identifier` y las manda a timbrar.

### 3.3. Gestión de Estado (Firebase Hooks)

-   `src/firebase/provider.tsx`: Componente `FirebaseProvider` que inicializa Firebase en el cliente y gestiona el estado de autenticación del usuario.
-   `src/firebase/firestore/use-doc.tsx` y `use-collection.tsx`: Hooks personalizados para suscribirse a datos de Firestore en tiempo real de forma eficiente.
-   `src/hooks/use-configurations.tsx`: Hook específico para obtener la lista de configuraciones de clientes HKA desde Firestore.

### 3.4. Interfaz de Usuario (`src/app/dashboard`)

-   `layout.tsx`: **Protector de Rutas**. Verifica si hay un usuario logueado. Si no lo hay, redirige al `/login`.
-   `settings/page.tsx`: Página para crear, editar y validar las configuraciones de los clientes HKA. Es el centro de mando de la aplicación.
-   `invoices/new/page.tsx` y `components/invoice-form.tsx`: Formulario para la creación manual de facturas.
-   `movements/page.tsx`: Muestra un historial en tiempo real de todas las sumisiones de facturas leídas desde Firestore, permitiendo ver detalles y reintentar envíos fallidos.

---

## 4. Flujo de Datos

### Flujo de Timbrado Manual

1.  **Usuario** rellena el formulario en `invoices/new`.
2.  Al hacer clic en "Crear Factura", el cliente llama al endpoint `POST /api/hka/timbrar` con los datos y el `configId` del cliente seleccionado.
3.  El endpoint crea un registro en `invoiceSubmissions` en Firestore con estado `pending`.
4.  Llama a la acción `timbrar(payload, configId, env)`.
5.  La acción `timbrar` carga las credenciales desde Firestore, obtiene un token de HKA y envía la factura.
6.  La respuesta de HKA (éxito o error) se guarda en `hkaResponses` y se actualiza el estado del registro en `invoiceSubmissions` a `certified` o `failed`.
7.  El resultado final se devuelve a la interfaz.

### Flujo de Autenticación de Usuario

1.  **Usuario** ingresa email y contraseña en `/login`.
2.  Se llama a `signInWithEmailAndPassword` de Firebase Auth.
3.  `FirebaseProvider` detecta el cambio de estado, actualiza el contexto del usuario.
4.  El `layout` del dashboard detecta un usuario activo y permite el acceso.
