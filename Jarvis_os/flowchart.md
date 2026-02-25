```mermaid
flowchart TD
    A[User] --> B[Frontend]
    B --> C[Backend API]
    C --> D[Database]
    D --> C
    C --> B
    B --> A
