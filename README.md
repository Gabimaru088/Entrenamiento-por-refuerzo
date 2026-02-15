# Laboratorio de IA por Refuerzo

Proyecto web interactivo que entrena varias IAs con **Q-learning** para aprender acciones básicas (caminar, saltar y correr) y alcanzar una meta en un entorno 2D.

## Características
- Menú de inicio con botones de configuración, iniciar, pausar y reiniciar.
- Configuración de episodios, velocidad, exploración (epsilon) y dificultad.
- Múltiples agentes con formas visuales distintas: araña, humanoide, zorro y gecko.
- Simulación visual ordenada en canvas con terreno, obstáculos y meta.
- Panel lateral con estadísticas en tiempo real (recompensa y tasa de éxito).

## Ejecutar localmente
```bash
python3 -m http.server 8000
```
Luego abrir `http://localhost:8000`.
