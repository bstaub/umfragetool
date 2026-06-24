# Docker Deployment für Umfrage-Tool

Diese Anleitung zeigt, wie man das Umfrage-Tool auf einer Synology NAS mit Docker deployt.

## Voraussetzungen
- Docker ist auf der Synology NAS installiert
- SSH-Zugriff zur NAS oder Synology Docker GUI verfügbar

## Methode 1: Docker Compose (Empfohlen für Synology)

### Schritt 1: Image bauen
```bash
docker-compose build
```

### Schritt 2: Container starten
```bash
docker-compose up -d
```

### Schritt 3: Applikation testen
Öffne im Browser: `http://<synology-ip>:3000`

## Methode 2: Nur Docker (Alternative)

### Image bauen
```bash
docker build -t umfrage-tool .
```

### Container starten
```bash
docker run -d \
  --name umfrage-tool \
  -p 3030:3033\
  -v umfrage-data:/app/data \
  --restart unless-stopped \
  umfrage-tool
```

## Daten persistent speichern

Die Datenbank wird im Docker-Volume `umfrage-data` gespeichert. Dies sichert deine Umfragen auch nach Neustarts:

```bash
# Volume anzeigen
docker volume ls

# Volume Details
docker volume inspect umfrage-data
```

## Logs anschauen

```bash
docker-compose logs -f umfrage
# oder
docker logs -f umfrage-tool
```

## Container stoppen

```bash
# Docker Compose
docker-compose down

# oder
# Docker nur
docker stop umfrage-tool
docker rm umfrage-tool
```

## Synology DSM Docker GUI (Ohne Kommandozeile)

1. Öffne **Docker** in Synology DSM
2. Gehe zu **Image** → **Build**
3. Wähle das Dockerfile
4. Klick auf **Build**
5. Gehe zu **Container**
6. Klick **Create** → wähle das neue Image
7. Trage den **Container-Namen** ein
8. Gehe zu **Port Settings** und matte **Host Port 3000** auf **Container Port 3000**
9. Gehe zu **Volume Settings** und matte `/app/data` auf ein lokales Verzeichnis
10. Starten

## Umgebungsvariablen

```bash
DB_PATH=/custom/path  # Optionaler Pfad für die Datenbank
NODE_ENV=production   # Produktionsumgebung
```

## Tipps für Synology

- **NAS IP herausfinden**: Synology Control Panel → Systemsteuerung → Informationen → LAN
- **SSH aktivieren**: Systemsteuerung → Terminal & SNMP → Terminal aktivieren
- **Backup der Datenbank**: Volume `umfrage-data` regelmäßig sichern
- **Port-Konflikt**: Falls Port 3000 belegt ist, ändere ihn in docker-compose.yml zu z.B. `3001:3000`

## Troubleshooting

### Container startet nicht
```bash
docker logs umfrage-tool
```

### Datenbank-Fehler
```bash
docker exec umfrage-tool rm -f /app/data/umfragen.db
docker restart umfrage-tool
```

### Performance auf Synology
- Begrenzen Sie Ressourcen in der Docker GUI
- Überwachen Sie die Speichernutzung
- Nutzen Sie SSD-Speicher für das Volume falls möglich
