# New Features Demo

## rastersysteme v2

- Images
- Tables
- Code blocks
- Nested bullets
- Custom fonts

---

## Nested Bullets

### STRUCTURE

- Frontend architecture
  - React components
  - State management
  - Routing layer
- Backend services
  - API routes
  - Database layer

```notes
This slide demonstrates nested bullet support. Indent with 2 spaces to create sub-items.
Top-level bullets get numbered accent dots; nested items get em-dash markers.
```

---

## Data Comparison

| Feature | Basic | Pro | Enterprise |
|---------|:-----:|:---:|:----------:|
| Users | 10 | 100 | Unlimited |
| Storage | 1 GB | 50 GB | 1 TB |
| Support | Email | Chat | Dedicated |
| API | No | Yes | Yes |
| SSO | No | No | Yes |

```notes
Tables are auto-detected from pipe-delimited markdown syntax.
Alignment is controlled with colons in the separator row: :---: for center, ---: for right.
```

---

## API Example

### CODE

```javascript
const response = await fetch('/api/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'slides' })
});

const data = await response.json();
console.log(data.results);
```

---

## Grid Configuration

```python
grid = Grid(
    cols=60,
    rows=40,
    margin=0.5,
    gutter=0.02
)

slide = grid.place(
    element="title",
    col=0, row=0,
    span_cols=24, span_rows=22
)
```

---

<!-- font: Georgia -->

## Custom Typography

This slide uses Georgia instead of Helvetica Neue.

- Serif fonts add warmth
- Good for editorial content
- Pairs well with Swiss grids

> Typography is the craft of endowing human language with a durable visual form.

---

## Project Roadmap

- Phase 1: Foundation
  - Grid system
  - Theme engine
  - Markdown parser
- Phase 2: Content types
  - Image support
  - Table rendering
  - Code blocks
- Phase 3: Polish
  - Custom fonts
  - Export options
  - Documentation

---

<!-- layout: section -->

Thank you
