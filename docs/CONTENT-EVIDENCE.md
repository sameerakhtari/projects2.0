# Content evidence and migration decisions

Reviewed 19 September 2026. The archive contains project records, not live inventory or uptime claims. The following repositories were read only:

| Source                                                                            | Inspected revision                         | Role                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Current portfolio](https://github.com/sameerakhtari/portfolio2.0)                | `66077045730f830b3ba6d8e23111e863a6ce1f4d` | `data/projects.ts`, `data/homelab.ts`, `data/profile.ts`, `data/diagrams.ts`            |
| [Historical archive](https://github.com/sameerakhtari/projects.sameerakhtari.com) | `bc17aa9de9310687393da04ea56331e9fc83213d` | All project descriptions and resource links in `index.html`; repository asset inventory |
| [Camera dashboard](https://github.com/sameerakhtari/camera-dashboard)             | `5f00d1d422a5451eab15119821c5234a5c30859d` | Public README and implementation inventory                                              |
| [Diary](https://github.com/sameerakhtari/riddle)                                  | `cab79f3d79d0f5ea3df3c3f21437e7fc7d9903d5` | Public README, platform and source inventory                                            |

The two reference designs were not reused. Existing image inventory contained portraits and a background rather than project evidence; these images were not migrated.

## Curated records

| Record                 | State      | Evidence and scope                                                                                                                                                                                                               |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homelab                | Evolving   | Portfolio infrastructure record, with newer owner-provided service context. Keep service experiments within the parent system.                                                                                                   |
| Reclaimed cluster      | Built      | Three boards, roughly 48 GB RAM and 290 pods belong to a documented test snapshot, not sustained capacity. Three control planes, etcd, kube-vip and Cilium were owner-confirmed on 28 June 2026.                                 |
| Operational automation | Built      | Documented IMAP → orchestration → browser extraction → CSV path. No employer/customer records, endpoints, recipients or impact metrics.                                                                                          |
| Observability          | Evolving   | July 2026 user confirmation and September confirmation of configured Prometheus/Grafana supersede the portfolio's stale planned status. Loki restart behavior prevents a blanket health claim. WAN/LAN exporters remain planned. |
| Smart Hat              | Experiment | Historical embedded vision concept. No clinical, product-release or navigation-safety claim.                                                                                                                                     |
| Encrypted chat         | Historical | University FYP completed by 2023. Preserve exploration of encryption/blockchain; remove unsupported “military-grade” marketing. The education period is not treated as the project's start date.                                 |
| Home network           | Historical | 2023 pfSense/x64 network foundation. No current gigabit-throughput guarantee.                                                                                                                                                    |
| NAS/media              | Historical | Earlier TrueNAS generation. Do not copy RAID5 reliability claims into current infrastructure.                                                                                                                                    |
| USB/Wi-Fi hardware     | Historical | Controlled learning experiment; explicitly credit the upstream open-source fork.                                                                                                                                                 |
| Smart home             | Historical | 2021 microcontroller lighting/fan experiment. No claim of current voice-service interoperability.                                                                                                                                |
| Camera dashboard       | Built      | Public implementation documents shared FFmpeg workers and MJPEG compatibility path. No measured CPU or latency claim.                                                                                                            |
| Handwritten diary      | Evolving   | Active Android implementation, upstream fork attribution, optional local/remote AI. No public-store release or completed iOS claim.                                                                                              |
| Volunteer management   | Historical | Recovered from legacy archive: Flask/MongoDB, volunteer tasks/hours/forms/awards. No current source or live deployment verified.                                                                                                 |

## Smaller projects and unresolved evidence

- MagicMirror and Overleaf appear as homelab milestones, not standalone flagship projects.
- Home Assistant, Frigate and go2rtc are described at the integration level; sensitive topology and customer material are absent.
- Doorbell/ESP, local AI summaries, inventory automation and WAN/LAN probes remain proposals.
- The music-service record does not establish a completed Navidrome/Swing deployment, so it is not promoted to a finished project.
- The old “Network Load Balancer Server” entry has only an in-progress title. It is not enough for a factual case study; retained here as a discovery item.
- Earlier mirrored storage and later boot-storage descriptions conflict. Current RAID topology, redundancy and recovery guarantees are intentionally omitted.
- Unknown dates remain unknown. A month/year snapshot is not expanded into an invented day.
- Private repositories were excluded from public discovery. No inference is made from their names or existence.

The seed is an initial editorial import. Once imported, D1 is authoritative; runtime requests never fall back to seed content.
