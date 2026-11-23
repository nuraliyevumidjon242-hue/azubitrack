import type { Category, ReportStatus } from '../../lib/types.js';

export interface DemoEntryPlan {
  category: Category;
  content: string;
  hours: number;
}

export interface DemoWeekPlan {
  /** 0 = current week, 1 = last week, ... */
  offset: number;
  status: ReportStatus;
  comment?: string;
  entries: DemoEntryPlan[];
}

export const LUKAS_WEEKS: DemoWeekPlan[] = [
  {
    offset: 5,
    status: 'FREIGEGEBEN',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Einrichtung der lokalen Entwicklungsumgebung (Visual Studio Code, Node.js, Git) sowie Anbindung an das interne Git-Repository durchgeführt.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Bearbeitung eines Tickets zur Anpassung der Benutzeroberfläche im Kundenportal; Anpassung von HTML- und CSS-Komponenten vorgenommen.',
        hours: 7,
      },
      {
        category: 'BETRIEB',
        content:
          'Teilnahme am Daily Scrum sowie Abstimmung der Aufgabenpriorisierung mit dem Team.',
        hours: 1,
      },
      {
        category: 'BETRIEB',
        content:
          'Durchführung von Funktionstests der angepassten Formulare und Dokumentation der Testergebnisse im Ticketsystem.',
        hours: 4,
      },
      {
        category: 'BETRIEB',
        content:
          'Überprüfung und Aktualisierung der technischen Dokumentation im internen Wiki.',
        hours: 8,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Unterweisung zur sicheren Verwendung von Passwort-Managern und Zwei-Faktor-Authentifizierung.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 8 – Daten systemübergreifend bereitstellen; Wiederholung der SQL-Grundlagen und Erstellung erster Abfragen.',
        hours: 8,
      },
    ],
  },
  {
    offset: 4,
    status: 'FREIGEGEBEN',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Entwicklung eines neuen REST-API-Endpunkts zur Abfrage von Kundendaten inklusive Validierung der Eingabeparameter.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Schreiben von Unit-Tests für den neuen Endpunkt mit Jest und Auswertung der Testergebnisse.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content:
          'Code-Review mit einem Kollegen durchgeführt und Feedback zur Verbesserung der Fehlerbehandlung umgesetzt.',
        hours: 3,
      },
      {
        category: 'BETRIEB',
        content:
          'Fehleranalyse in der Testumgebung: Behebung eines Fehlers bei der Datenbankverbindung.',
        hours: 7,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Interne Schulung zu Clean-Code-Prinzipien und Namenskonventionen im Projekt.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 9 – Netzwerke nutzen; Konfiguration von IP-Adressen und Subnetzmasken geübt.',
        hours: 8,
      },
    ],
  },
  {
    offset: 3,
    status: 'ABGELEHNT',
    comment:
      'Bitte ergänzen Sie die Tätigkeiten um konkrete Ergebnisse und geben Sie die behandelten Berufsschulthemen genauer an. Vielen Dank!',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Implementierung einer Suchfunktion im internen Werkzeug auf Basis von Elasticsearch.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Anpassung der Datenbankabfragen zur Verbesserung der Ladezeiten und Analyse der Ausführungspläne.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content:
          'Besprechung der Anforderungen mit dem Product Owner und Dokumentation der Ergebnisse im Ticket.',
        hours: 2,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Unterweisung zum Datenschutz und zum Umgang mit personenbezogenen Daten (DSGVO).',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content: 'Berufsschule: Lernfeld 8.',
        hours: 8,
      },
    ],
  },
  {
    offset: 2,
    status: 'FREIGEGEBEN',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Überarbeitung der Fehlerbehandlung in der Anwendung und Einführung einheitlicher Fehlermeldungen.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Durchführung eines Deployments auf die Testumgebung mittels GitLab-CI/CD-Pipeline.',
        hours: 4,
      },
      {
        category: 'BETRIEB',
        content:
          'Analyse und Behebung eines Darstellungsfehlers in der mobilen Ansicht des Kundenportals.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content: 'Teilnahme an der Sprint-Planung und Schätzung der anstehenden Aufgaben.',
        hours: 2,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Workshop zur Nutzung von Docker-Containern in der lokalen Entwicklungsumgebung.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 10 – Benutzerschnittstellen gestalten; Erstellung eines Mockups mit Figma.',
        hours: 8,
      },
    ],
  },
  {
    offset: 1,
    status: 'EINGEREICHT',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Umsetzung einer neuen Auswertungsansicht im Backoffice mit React und TypeScript.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Anbindung der Ansicht an die REST-API und Absicherung der Daten mit Zod-Schemata.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content:
          'Durchführung von Regressionstests nach dem Deployment und Dokumentation der Ergebnisse.',
        hours: 4,
      },
      {
        category: 'BETRIEB',
        content: 'Behebung eines Fehlers bei der Berechnung der Umsatzsteuer.',
        hours: 3,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Unterweisung zur Barrierefreiheit von Webanwendungen nach WCAG 2.1.',
        hours: 3,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 11 – Software testen; Erstellung von Testfällen und Fehlerprotokollen.',
        hours: 8,
      },
    ],
  },
  {
    offset: 0,
    status: 'ENTWURF',
    entries: [
      {
        category: 'BETRIEB',
        content: 'heute bug fix gemacht und api getestet',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Implementierung der neuen Filterfunktion im Dashboard begonnen und Komponenten strukturiert.',
        hours: 6,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Unterweisung zur sicheren Nutzung von KI-Werkzeugen im Entwicklungsalltag.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 12 – Kundenaufträge bearbeiten; Planung eines Projektangebots.',
        hours: 8,
      },
    ],
  },
];

export const EMMA_WEEKS: DemoWeekPlan[] = [
  {
    offset: 2,
    status: 'FREIGEGEBEN',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Konfiguration neuer Arbeitsplätze inklusive Betriebssysteminstallation, Softwareverteilung und Anbindung an die Domäne.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Einrichtung und Prüfung der Datensicherung auf dem zentralen Fileserver.',
        hours: 5,
      },
      {
        category: 'BETRIEB',
        content:
          'Bearbeitung von Support-Anfragen im Ticketsystem und Dokumentation der Lösungen in der Wissensdatenbank.',
        hours: 5,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Unterweisung zu Netzwerkkomponenten: Switch, Router und Access Point im Überblick.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 9 – Netzwerke nutzen; Aufbau und Adressierung eines kleinen Netzwerks.',
        hours: 8,
      },
    ],
  },
  {
    offset: 1,
    status: 'EINGEREICHT',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Einrichtung eines virtuellen Servers in der Testumgebung und Installation eines Monitoring-Werkzeugs.',
        hours: 8,
      },
      {
        category: 'BETRIEB',
        content:
          'Analyse von Protokolldateien zur Fehlersuche bei einem Anmeldefehler im Active Directory.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content:
          'Erstellung einer Anleitung zur Wiederherstellung von Benutzerprofilen für das Support-Team.',
        hours: 4,
      },
      {
        category: 'UNTERWEISUNG',
        content:
          'Interne Schulung zu IT-Sicherheitsrichtlinien und zum Melden von Sicherheitsvorfällen.',
        hours: 4,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 10 – Benutzerschnittstellen gestalten; Planung einer benutzerfreundlichen Oberfläche.',
        hours: 8,
      },
    ],
  },
  {
    offset: 0,
    status: 'ENTWURF',
    entries: [
      {
        category: 'BETRIEB',
        content:
          'Installation und Konfiguration eines Druckers im Kundennetzwerk inklusive Treiberprüfung.',
        hours: 6,
      },
      {
        category: 'BETRIEB',
        content: 'Bestandsaufnahme der Hardware im Serverraum und Aktualisierung der Inventarliste.',
        hours: 6,
      },
      {
        category: 'BERUFSSCHULE',
        content:
          'Berufsschule: Lernfeld 11 – Software testen; Erstellung eines Testprotokolls für eine Neuinstallation.',
        hours: 8,
      },
    ],
  },
];
