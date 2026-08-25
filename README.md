# Inventra - Geavanceerd Voorraad & Logistiek Management Systeem

Een comprhensive, cross-platform mobiele applicatie voor geïntegreerd voorraadbeheer, orderverwerkring, en operationele logistiek. Gebouwd met Expo en React Native met TypeScript.

## 🎯 Visie & Doelstelling

Inventra is ontworpen als een volledig bedrijfsmanagementsysteem dat logistieke operaties stroomlijnt door:
- **Real-time voorraadbewaking** - Automatische monitoring van voorraadhoeveelheden en THT/vervaldatums
- **Intelligente orderverwerkking** - Naadloze bestelling, toewijzing en tracking
- **Personeelscoördinatie** - Planning, roostering en taakbeheer
- **Gegevensanalyse** - Inzichten in promoties, verkoop en voorraadbewegingen
- **Multi-stakeholder toegang** - Klanten, medewerkers, roosterplanners en managers

## 📱 Kernfunctionaliteit

### 1. **Voorraadbeheer** (#1)
- **Product Scanner** - Barcode-scanning voor snelle voorraadinput
- **Voorraadhoeveelheid Aanpassen** - Real-time aanpassingen
- **Minimale Voorraadinstellingen** - Automatische alerts wanneer voorraden kritisch worden
- **Voorraadontwikkeling** - Trends en analytics

### 2. **THT/Vervaldatum Management** (#5)
- **Datum Bijna Verstreken Waarschuwingen** - Pro-actieve meldingen
- **THT Tracking** - Volledige levenscyclus van producten
- **Automatische Melding Systeem** - Notificaties wanneer vervaldatums naderen

### 3. **Orderbeheer & Bestellingen** (#8)
- **Bestelling Aanmaken** - Flexibele ordercreatie workflow
- **Product Toevoegen met Hoeveelheden** - Multi-product orders
- **Gepersonaliseerde Orders** - Per-product aantallen
- **Automatische Bestelling/Inkoop** - Intelligente reorder triggers op minimale voorraad

### 4. **Contactbeheer** (#12)
- **Leveranciers Management** - Volledige leveranciersdatabase
- **Leveringstijden** - Delivery schedule tracking
- **Personeelslijsten** - Werknemer informatie

### 5. **Geschiedenistracking** (#16)
- **Voorraadontwikkeling** - Historische voorraadbewegingen
- **Bestelgeschiedenis** - Audittrail van alle orders
- **Personeelgeschiedenis** - Werknemer actieverslag

### 6. **Personeelsbeheer** (#20)
- **Profielbeheer** - Werknemer informatie
- **Rollen & Toestemmingen** - RBAC systeem
- **Contactgegevens** - Communicatie kanalen
- **Planning** - Shifttoewijzing
- **Indienstmeldingen** - HR tracking

### 7. **Roostering & Planning** (#26)
- **Planningschedules** - Visuele week/maand views
- **Beschikbaarheid Beheer** - Werknemer beschikbaarheid
- **Ruiterverzoeking** - Shift swapping
- **Automatische Roosterplanning** - AI-driven scheduling

### 8. **Verkoopsanalyse & Gifters** (#31)
- **Verkoopsrapporten** - Per-product, per-categorie analyse
- **Marges** - Margin berekeningen en tracking
- **Slow-movers** - Producten met lage omzet
- **Verkoopsfichers** - Top seller tracking
- **AI Rapportage** - Geautomatiseerde rapporten

### 9. **Ranking & Performance** (#42)
- **Rank Tracking** - Producten per populariteit
- **Performance Metrics** - Voorraadomzet ratios

### 10. **Notificatie Systeem** (#43)
- **Aanvragen** - Voorraadrequests en alerts
- **Recalls** - Product recalls management
- **Device Sync** - Multi-device synchronisatie
- **Product Aanbevelingen** - Intelligente suggesties gebaseerd op verkoop
- **Update Warnings** - Systeem notification engine

### 11. **Taskbeheer** (#47)
- **Taakspreiding** - Taken toewijzen aan personeelsleden
- **Vaste Taken Toegevoegd** - Standaard recurring tasks
- **Eigen Taken Kunnen Toevoegen** - Flexibele taakschepping
- **Deadline Management** - Timeline tracking
- **Planningseffectiviteit** - Taakvoltooimgspredictie

### 12. **Promotie Management** (#52)
- **Actie Bijkijken** - Alle promoties zichtbaar
- **Filter op Artikel Groep** - Granular filtering
- **Filter op Subgroep** - Hierarchische categoriering
- **Gehele Acties Bekijken** - Promotie details

### 13. **Document Maker** (#58)
- **Custom Actiekaarten** - Downloaden/maken
- **Bulk Labeling** - Massamedia generatie
- **Analyse Downloads** - Rapportgeneratie

## 🎨 Design & Styling

### Design Filosofie
Inventra volgt moderne **Material Design 3** principes met aanpassingen voor:
- **Accessibility First** - WCAG 2.1 AA compliance
- **Dark/Light Mode** - Automatische systeemthema support
- **Responsive Layout** - Tablet-optimized UI
- **Touch-optimized** - Grote interactive targets (min. 44x44dp)

### Thema & Kleurenschema
```
Primary:      #007AFF (Accent blauw)
Secondary:    #5AC8FA (Licht blauw)
Background:   #E6F4FE (Zeer licht blauw - zie app.json)
Surface:      #FFFFFF (Licht) / #121212 (Donker)
Success:      #34C759 (Groen)
Warning:      #FF9500 (Oranje)
Error:        #FF3B30 (Rood)
```

### UI Componenten
- **Bottom Tab Navigation** - 4-5 hoofdsecties
- **Modal Workflows** - Formulieren voor creatie/editing
- **Collapsible Sections** - Geneste categorieën
- **Icon System** - Expo Vector Icons (Ionicons)
- **Drawer Menu** - Zijkant navigatie voor extra opties

## 👥 User Types & Access Levels

| Rol | Toegang |
|-----|---------|
| **Magazijnmedewerker** | Voorraadinput, scannen, bestellingen ophalen |
| **Supervisor/Planner** | Roostering, taakbeheer, recalls |
| **Manager** | Alle analytische reports, instellingen |
| **Klant** | Orderhistorie, bestellingen plaatsen |
| **Leverancier** | Order confirmatie, delivery tracking |

## 🔄 Gebruiksscenario's

### Scenario 1: Daily Inventory Check
```
1. Magazijnmedewerker opent app → Orders Tab
2. Scant barcodes van binnenkomende goederen
3. Systeem update voorraadhoeveelheden
4. App stuurt notificatie naar manager bij lage voorraden
5. Auto-order trigger wanneer minimale voorraden bereikt
```

### Scenario 2: THT Management
```
1. App monitort vervaldatums achtergrond
2. Wanneer datum binnen 7 dagen ligt → Warning notification
3. Magazijnmedewerker ziet "THT Alert" in dashboard
4. Kan product manual naar "Urgent verkoophoogte" verplaatsen
5. Document Maker genereert nieuwe prijskaartjes
```

### Scenario 3: Rooster Plannen
```
1. Planner opent Rooster module
2. Ziet beschikbaarheid alle medewerkers
3. Maakt shifts met AI-suggestion gebaseerd op historisch patroon
4. Verstuurt notificatie naar medewerkers
5. Medewerkers kunnen shifts swappen via app
```

### Scenario 4: Analytics & Rapporten
```
1. Manager opent Analyse dashboard
2. Ziet slow-movers, top-sellers, margin trends
3. AI genereert promotie suggesties
4. Download rapport als PDF
5. Stuurt reclamekaarten naar grafische afdeling
```

## 📊 Data Flow Architecture

```
App (Mobile) 
    ↓
Expo Router (UI)
    ↓
React Hooks + State Management
    ↓
Backend API (MySQL)
    ↓
- Orders Database
- Inventory Tables
- Personnel Records
- Product Catalog
- Transaction History
```

### Real-time Features
- **Push Notifications** - Inventory alerts, task assignments, recalls
- **Database Sync** - Event-driven updates via `push:db-event`
- **Multi-device Sync** - Actions sync across all user devices

## 🗂️ Technical Architecture

## 🗂️ Technical Architecture

- **Framework**: Expo & React Native
- **Routing**: Expo Router (file-based routing)
- **Navigatie**: React Navigation (bottom tabs)
- **Taal**: TypeScript
- **Icons**: Expo Vector Icons
- **Camera**: Expo Camera (voor barcode scanning)
- **Notificaties**: Expo Notifications
- **Database**: MySQL (via backend)
- **Linting**: ESLint

## 📋 Vereisten

- Node.js (v18+)
- npm of yarn
- Expo CLI: `npm install -g expo-cli`
- Fysiek apparaat of emulator (Android/iOS)

## 🚀 Installatie en Setup

### 1. Dependencies installeren
```bash
cd inventra
npm install
```

### 2. Project starten
```bash
npm start
```

Dit opent de Expo DevTools. Je kan vervolgens kiezen:
- **iOS**: Druk `i` (iOS emulator) of scan QR-code met fysiek apparaat
- **Android**: Druk `a` (Android emulator) of scan QR-code
- **Web**: Druk `w` (development server)

### 3. Platform-specifiek starten
```bash
npm run ios        # iOS emulator
npm run android    # Android emulator
npm run web        # Web development server
```

## 🔐 Authentication & Beveiliging

- **Role-Based Access Control (RBAC)** - Gebruikersrollen bepalen toegang
- **Sessie Management** - Token-based authentication
- **Encrypted Storage** - Gevoelige gegevens versleuteld opgeslagen
- **API Validation** - Backend request validation

## 🔌 Backend Integratie

De app communiceert met een backend voor:
- **MySQL Database**: Ordergegevens, producten, contacten, personeelsinfo
- **Push Notifications**: Via Expo Notifications
- **Database Events**: Real-time updates via `push:db-event`
- **Recalls Sync**: Product recalls management via `push:mysql-recalls`

### Environment Setup
Zorg dat volgende environment variabelen zijn geconfigureerd:
- `BACKEND_URL` - Backend API endpoint
- `NOTIFICATION_TOKEN` - Expo push notification token
- `DB_CONNECTION_STRING` - MySQL verbinding (backend-side)

## 📁 Projectstructuur

```
inventra/
├── app/                    # App-schermen en routing
│   ├── (tabs)/            # Tab-gebaseerde schermen
│   │   ├── index.tsx      # Dashboard/Home
│   │   ├── orders-screen.tsx    # Bestellingsoverzicht
│   │   ├── products.tsx         # Productencatalogus
│   │   └── Taken.tsx            # Taakbeheer
│   ├── product/           # Productdetails
│   │   └── [barcode].tsx  # Dynamic route voor product details
│   ├── _layout.tsx        # Root layout
│   ├── modal.tsx          # Generic modal provider
│   ├── modal-new-order.tsx      # Order creatie flow
│   ├── modal-order-contact.tsx  # Contact selectie
│   └── modal-order-detail.tsx   # Order details view
│
├── components/            # Herbruikbare componenten
│   ├── ui/                      # Base UI componenten
│   │   ├── collapsible.tsx      # Uitvouwbare sections
│   │   └── icon-symbol.tsx      # Icon wrapper
│   ├── scanner-modal.tsx        # Barcode scanner interface
│   ├── drawer-menu.tsx          # Zijkant navigatiemenu
│   ├── themed-text.tsx          # Thema-aware tekst
│   ├── themed-view.tsx          # Thema-aware containers
│   ├── parallax-scroll-view.tsx # Scroll effect
│   ├── haptic-tab.tsx           # Haptic feedback tabs
│   ├── external-link.tsx        # Link handler
│   └── hello-wave.tsx           # Welcome component
│
├── constants/                    # App constanten
│   └── theme.ts                 # Thema definitie
│
├── data/                         # Mock data en utilities
│   ├── contacts.ts              # Contacten dataset
│   ├── products.ts              # Producten catalog
│   ├── order-data.ts            # Order templates
│   └── contact-selection.ts     # Contact filtering utils
│
├── hooks/                        # Custom React hooks
│   ├── use-theme-color.ts       # Thema kleuren hook
│   ├── use-color-scheme.ts      # OS kleurenschema detectie
│   └── use-color-scheme.web.ts  # Web variant
│
├── scripts/                      # Utility scripts
│   ├── reset-project.js         # Project reset
│   ├── send-db-event-push.mjs   # DB event handler
│   └── sql/                      # Database scripts
│
├── assets/                       # Media assets
│   └── images/                  # Icons & images
│       ├── icon.png
│       ├── favicon.png
│       ├── android-icon-*.png
│       └── ...
│
├── app.json                      # Expo configuratie
├── tsconfig.json                 # TypeScript config
├── eslint.config.js              # ESLint rules
├── package.json                  # Dependencies
└── README.md
```

## 🎯 Workflow Examples

### Workflow 1: Voorraadinname
```
Magazijnmedewerker
  → Open app (tab 1: Producten)
  → Druk "Scan Barcode" knop
  → Richt camera op barcode
  → App ziet product in systeem
  → Voer hoeveelheid in
  → Systeem update voorraadhoeveelheid
  → Notificatie naar manager als onder minimum
  → Auto-trigger bij kritieke hoeveelheid → Order aanmaken
```

### Workflow 2: Bestelling Plaatsen
```
Besteller
  → Tab 2: Bestellingen
  → Druk "Nieuwe Bestelling"
  → Modal-new-order opent
  → Selecteer contactpersoon (leverancier)
  → Voeg producten toe met barcodes
  → Stel hoeveelheden per product in
  → Controleer totaal
  → Plaats bestelling
  → Systeem verstuurt naar backend
  → Notificatie aan leverancier (extern)
```

### Workflow 3: THT Monitoring
```
Background Proces
  → App controleert THT datums
  → Wanneer < 7 dagen → Voeg toe aan "Urgent" lijst
  → Wanneer < 3 dagen → Push notification
  → Magazijnmedewerker ziet in dashboard
  → Kan Label Maker gebruiken
  → Document Maker genereert prijskaartje
  → Print op etiketteer
```

### Workflow 4: Rooster Management
```
HR/Planner
  → Tab 3: Rooster
  → Ziet week/maand overzicht
  → Bekijk beschikbaarheid medewerkers
  → AI geeft shift suggesties
  → Drag-drop shifts naar medewerkers
  → Systeem verstuurt notificatie
  → Medewerkers kunnen accepteren/afwijzen
  → Multi-device sync → iedereen heeft actueel rooster
```

### Workflow 5: Analytics & Rapporten
```
Manager/Directeur
  → Analyse tab
  → Dashboard met KPIs:
     - Voorraadomzet per product
     - Slow-movers (< 5 verkocht in week)
     - Margin analyse
     - Top 10 bestsellers
     - Promotie ROI
  → Download rapport als PDF
  → Share met team
  → AI genereert suggesties voor laaglopende items
```

## 📊 Data Models

### Product Model
```javascript
{
  id: number,
  barcode: string,
  naam: string,
  beschrijving: string,
  categorie: string,
  huidigVoorraad: number,
  minimaalVoorraad: number,
  kostprijs: number,
  verkoopprijs: number,
  tht_datum: date,
  leverancier_id: number,
  rank: number // Uit ranking engine
}
```

### Order Model
```javascript
{
  id: number,
  ordernummer: string,
  contactpersoon_id: number,
  items: [{
    product_id: number,
    hoeveelheid: number,
    eenheidsprijs: number
  }],
  totaal: number,
  status: 'open' | 'bevestigd' | 'verzonden' | 'ontvangen',
  aanmaakdatum: date,
  leverdatum: date
}
```

### Personnel Model
```javascript
{
  id: number,
  voornaam: string,
  achternaam: string,
  email: string,
  telefoon: string,
  rol: 'medewerker' | 'supervisor' | 'manager',
  beschikbaarheid: {
    maandag: ['08:00-17:00'],
    dinsdag: ['08:00-17:00'],
    ...
  },
  geplande_shifts: [{
    datum: date,
    start: time,
    einde: time
  }]
}
```

## 🧩 Hoofdcomponenten & Modals

### Tabs Navigation
1. **Home/Dashboard** - KPI overview, recente activiteiten
2. **Products** - Catalogus met scanfunctie
3. **Orders** - Bestellingsmanagement
4. **Rooster** - Personnel scheduling
5. **More** - Drawer menu voor verdere opties

### Modal Dialogs
- `modal-new-order.tsx` - Multi-stap order creatie
- `modal-order-contact.tsx` - Contactselectie interface  
- `modal-order-detail.tsx` - Gedetailleerde order view
- Scanner Modal - Full-screen barcode input

### Custom Hooks
- `useThemeColor()` - HuidigetHema kleur ophalen
- `useColorScheme()` - Dark/light mode detectie

## 🔧 Beschikbare Scripts

```bash
# Development
npm start              # Start development server
npm run ios           # iOS emulator
npm run android       # Android emulator
npm run web           # Web version

# Utilities
npm run lint          # Lint code met ESLint
npm run reset-project # Reset project naar initiële state
npm run push:db-event # Push DB event notifications
npm run push:mysql-recalls  # MySQL recalls synchroniseren
```

## 📦 Key Dependencies

| Package | Versie | Gebruik |
|---------|--------|---------|
| `expo-router` | ~6.0 | File-based routing |
| `expo-camera` | ~17.0 | Barcode scanning |
| `expo-notifications` | ~0.32 | Push notifications |
| `@react-navigation/*` | ^7.0 | Bottom tabs navigatie |
| `@react-native-community/datetimepicker` | ^8.6 | Datumkiezer |
| `@expo/vector-icons` | ^15.0 | Icon library |

## 🎨 Thema en Styling

Het thema is geconfigureerd in [constants/theme.ts](inventra/constants/theme.ts):

- **Light Mode**: Lichte kleuren met #E6F4FE basis
- **Dark Mode**: Donkere kleuren voor nacht gebruik
- **Auto**: Automatische systeemvoorkeuren

### Thema Properties
```javascript
{
  colors: {
    text: '#000000',
    background: '#ffffff',
    tint: '#007AFF',
    tabIconDefault: '#ccc',
    tabIconSelected: '#007AFF',
  }
}
```

## 📱 Device Support

- **iOS**: iPhone en iPad (via `supportsTablet: true`)
- **Android**: Edge-to-edge enabled, adaptive icons, predictive back gesture
- **Web**: Static output export (niet primary use case)
- **Orientations**: Portrait primair, landscape supported

## 🐛 Troubleshooting

### App start errors
1. Verwijder `node_modules` en `.expo` folder
2. Voer `npm install` opnieuw uit
3. Voer `npm run reset-project` uit
4. Zorg voor correcte Node.js versie (v18+)

### Camera/Scanner problemen
- Zorg dat camera permissions zijn gegeven
- Controleer of device camera hardware ondersteunt
- Test met physical device, emulator heeft soms limitaties

### Notificaties werken niet
- Zorg dat Expo push tokens correct zijn ingesteld
- Backend moet Expo API kunnen bereiken
- Check firewall/network restrictions
- Verifyeer notification payload format

### Theme/Styling issues
- Controleer OS-instellingen voor dark/light mode
- Clear app cache: `npm run reset-project`
- Verifyeer ColorScheme hook implementatie

### Database sync problemen
- Controleer backend API connectivity
- Verifyeer MySQL connection op backend
- Check event push logs

## 🔐 Best Practices

### Security
- Nooit credentials in code hardcoden
- Gebruik environment variabelen
- Valideer alle user inputs op backend
- Implementeer rate limiting op API

### Performance
- Memoize components met `React.memo`
- Gebruik FlatList voor grote lijsten
- Optimize images (Expo Image)
- Lazy-load zware modals

### Code Quality
- Run `npm run lint` voordat je commit
- Volg TypeScript strict mode
- Schrijf meaningful commit messages
- Code review alle PRs

## 📞 Support & Contact

Voor vragen, bugs of feature requests:
1. Check bestaande issues
2. Maak gedetailleerde bug report
3. Contacteer development team

## 📝 Changelog

### Version 1.0.0
- Initial release
- Voorraadbeheer, ordermanagement
- Roosterplanning
- Analytics dashboard
- Notificatie systeem