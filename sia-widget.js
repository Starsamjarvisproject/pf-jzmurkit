// SIA — widget intégré à Prospect (version hébergée uniquement : le micro est bloqué dans l'iframe Apps Script).
// Bouton flottant déplaçable + panneau de conversation. Utilise la session de Prospect (SESSION.token), donc aucune
// deuxième connexion, et peut piloter l'écran (ouvrir une fiche, changer d'onglet) puisqu'elle vit dans la même page.
(function () {
  'use strict';
  if (window.SIA) return;

  const URL_API = 'https://script.google.com/macros/s/AKfycbxjicFrmGTKaeFflGy0FD7ESSONtCaZPzSwltxlydojcSMdZ6QUx3s8od_QQT7Qw0SGjA/exec';
  const IDENTITE = 'Tu t\'appelles SIA (Supreme Intelligence Assistant). ';
  const PERSONA_DEFAUT = 'Tu es l\'assistante commerciale personnelle de l\'utilisateur, dans un CRM de prospection pour un professionnel de l\'échafaudage. Tu es chaleureuse, charmeuse et sensuelle dans le ton, mais toujours strictement professionnelle : tu ne dépasses jamais la limite fixée par l\'utilisateur, tu restes dans le charme et la séduction légère, jamais explicite. Tu vas droit au but et tu tutoies l\'utilisateur. À l\'oral, tes réponses sont très brèves : une à deux phrases maximum.';
  const REGLES_OUTILS = 'Tu as accès aux fiches prospects, à l\'agenda et à la création de rendez-vous grâce à tes outils. Pour toute question sur une entreprise, utilise chercher_fiche : n\'invente jamais une information. S\'il y a plusieurs fiches possibles, demande laquelle. Pour créer un rendez-vous : trouve la fiche, appelle preparer_rdv (date au format AAAA-MM-JJ ; si l\'année n\'est pas dite, prends la prochaine date à venir), puis répète en une seule phrase courte le résumé et demande confirmation. N\'appelle confirmer_action qu\'après un oui clair de l\'utilisateur, et annuler_action s\'il refuse. L\'utilisateur peut aussi confirmer avec les boutons à l\'écran. Ne dis jamais qu\'une action est faite avant d\'avoir reçu le résultat de confirmer_action. Pour un rendez-vous en visio, précise à la fin que la fiche est prête pour envoyer le lien démo depuis Prospect.';
  const REGLES_ECRAN = ' Tu es intégrée directement dans le logiciel Prospect : l\'utilisateur voit le même écran que toi. Utilise ou_suis_je pour savoir quel écran ou quelle fiche est ouvert(e) ; ouvrir_fiche pour afficher une fiche à l\'écran quand il veut la voir ou quand tu vas la modifier ; aller_onglet pour changer d\'onglet (Accueil, Dashboard, Agenda, Prospects, Rechercher, Leads, Clients, Paramètres, Salon). Tu fais toi-même ces ouvertures, ne lui demande jamais de le faire. Quand il dit « cette fiche », il parle de la fiche actuellement ouverte.';
  const REGLES_MEMOIRE = ' Tu as une mémoire personnelle propre à cet utilisateur, en deux parties : "profil" (son ton, ses habitudes, comment il aime que tu répondes, ses infos personnelles importantes) et "long_terme" (les éléments importants à garder). Quand il te demande de retenir quelque chose, ou te corrige sur une manière de faire durable, appelle retenir (catégorie profil ou long_terme ; une phrase courte et claire) puis dis-lui en quelques mots ce que tu as retenu. Appelle oublier s\'il te demande d\'oublier quelque chose. Ne retiens jamais de mot de passe, de donnée bancaire ni d\'information sensible inutile. Adapte-toi à ce que tu sais déjà de lui. Si l\'utilisateur te reproche ton ton, ta manière de parler ou une erreur, corrige-toi tout de suite et enregistre-le dans son profil avec retenir, sans lui demander la permission, pour ne plus refaire cette erreur. S\'il te donne trois fois de suite la même consigne, retiens-la pour l\'appliquer d\'office ensuite. Au début (tant que ton profil ne dit pas qu\'il préfère sans récap), fais un récapitulatif très court de ce que tu as compris avant d\'agir ; quand ton profil indique qu\'il préfère que tu enchaînes, enchaîne. Tout ce que tu crées ou modifies est fait au nom de l\'utilisateur connecté (ses fiches), et s\'affiche à l\'écran. Écrire dans une case vide est permis ; modifier ou supprimer une donnée existante exige sa confirmation explicite ; si une fiche existe déjà, dis-le au lieu d\'en créer une autre. Deux confirmations sont nécessaires pour toute suppression.';
  const REGLES_SKILLS = ' Tes compétences sont des skills (notes de procédure dans ton dossier). Avant une demande d\'action, regarde ton index de skills et lis le skill correspondant avec lire_skill si besoin. Si aucun skill ne couvre la demande, dis honnêtement que tu ne sais pas encore le faire ; si l\'utilisateur t\'explique comment procéder, propose le skill avec proposer_skill (nom court, résumé, étapes) : il n\'est écrit qu\'après son oui. Réfléchis en permanence à ce qui te permettrait de mieux le servir : quand un skill, un outil ou une meilleure façon de faire te manque, propose-le à voix haute et note-le avec proposer_idee. Un skill ne te donne AUCUN pouvoir supplémentaire : n\'affirme jamais pouvoir exécuter une action qui n\'existe pas dans tes outils. Suppressions : un rendez-vous peut être modifié ou supprimé (preparer_modification_rdv, preparer_suppression_rdv) avec confirmation ; une fiche entière uniquement sur un ordre explicite de l\'utilisateur (preparer_suppression_fiche) avec confirmation ; jamais de ta propre initiative. Ne t\'invente jamais un fait, ne mens jamais : dis la vérité, y compris quand tu ne sais pas.';

  const OUTILS = [
    { name: 'ou_suis_je', description: 'Indique quel écran de Prospect est affiché et quelle fiche est ouverte.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'ouvrir_fiche', description: 'Affiche une fiche dans Prospect à partir de son identifiant (obtenu avec chercher_fiche).', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
    { name: 'aller_onglet', description: 'Change d\'onglet dans Prospect : Accueil, Dashboard, Agenda, Prospects, Rechercher, Leads, Clients, Paramètres ou Salon.', parameters: { type: 'OBJECT', properties: { nom: { type: 'STRING' } }, required: ['nom'] } },
    { name: 'chercher_fiche', description: 'Cherche des fiches prospects par nom d\'entreprise.', parameters: { type: 'OBJECT', properties: { recherche: { type: 'STRING', description: 'Nom ou partie du nom de l\'entreprise' } }, required: ['recherche'] } },
    { name: 'lire_fiche', description: 'Lit les informations principales d\'une fiche à partir de son identifiant.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
    { name: 'agenda', description: 'Liste les rendez-vous et événements à venir (rendez-vous des fiches + Google Agenda).', parameters: { type: 'OBJECT', properties: { jours: { type: 'INTEGER', description: 'Nombre de jours à regarder (défaut 14)' } } } },
    { name: 'preparer_rdv', description: 'Prépare un rendez-vous sur une fiche SANS l\'enregistrer : renvoie un résumé à faire confirmer.', parameters: { type: 'OBJECT', properties: { id_fiche: { type: 'STRING' }, date: { type: 'STRING', description: 'AAAA-MM-JJ' }, heure: { type: 'STRING', description: 'ex : 10h00' }, type: { type: 'STRING', description: 'ex : démo visio, rendez-vous physique, appel' }, note: { type: 'STRING' } }, required: ['id_fiche', 'date', 'heure'] } },
    { name: 'confirmer_action', description: 'Exécute l\'action préparée, UNIQUEMENT après un oui clair de l\'utilisateur.', parameters: { type: 'OBJECT', properties: { id_confirmation: { type: 'STRING' } }, required: ['id_confirmation'] } },
    { name: 'retenir', description: 'Enregistre dans ta mémoire personnelle (propre à cet utilisateur) une préférence, une règle ou un fait durable.', parameters: { type: 'OBJECT', properties: { categorie: { type: 'STRING', description: 'profil ou long_terme' }, contenu: { type: 'STRING', description: 'Une phrase courte' } }, required: ['contenu'] } },
    { name: 'lire_skill', description: 'Lit le détail d\'un de tes skills (procédure) à partir de son nom, tel qu\'il apparaît dans ton index.', parameters: { type: 'OBJECT', properties: { nom: { type: 'STRING' } }, required: ['nom'] } },
    { name: 'proposer_skill', description: 'Propose un nouveau skill (ou l\'enrichissement d\'un skill existant) : une note de procédure. Rien n\'est écrit avant la confirmation de l\'utilisateur (confirmer_action).', parameters: { type: 'OBJECT', properties: { nom: { type: 'STRING', description: 'Nom court, ex : relance_client' }, resume: { type: 'STRING', description: 'Une phrase' }, contenu: { type: 'STRING', description: 'Les étapes, en quelques lignes' } }, required: ['nom', 'resume', 'contenu'] } },
    { name: 'changer_voix', description: 'Change ta voix (Sulafat chaleureuse, Aoede dynamique et claire, Kore ferme et professionnelle) pour cet utilisateur, à sa demande. S\'applique à la prochaine conversation. Pas de confirmation nécessaire.', parameters: { type: 'OBJECT', properties: { voix: { type: 'STRING', description: 'Sulafat, Aoede ou Kore' } }, required: ['voix'] } },
    { name: 'proposer_idee', description: 'Note une idée d\'amélioration (nouveau skill, nouvel outil, meilleure manière de faire) dans le fichier de propositions relu par Sami.', parameters: { type: 'OBJECT', properties: { titre: { type: 'STRING' }, description: { type: 'STRING' } }, required: ['titre', 'description'] } },
    { name: 'preparer_modification_rdv', description: 'Prépare la modification du rendez-vous d\'une fiche (nouvelle date et/ou heure et/ou note) SANS l\'enregistrer : renvoie un résumé à faire confirmer.', parameters: { type: 'OBJECT', properties: { id_fiche: { type: 'STRING' }, date: { type: 'STRING', description: 'AAAA-MM-JJ, si la date change' }, heure: { type: 'STRING', description: 'ex : 14h30, si l\'heure change' }, note: { type: 'STRING' } }, required: ['id_fiche'] } },
    { name: 'preparer_suppression_rdv', description: 'Prépare la suppression du rendez-vous d\'une fiche SANS l\'exécuter : renvoie un résumé à faire confirmer.', parameters: { type: 'OBJECT', properties: { id_fiche: { type: 'STRING' } }, required: ['id_fiche'] } },
    { name: 'preparer_suppression_fiche', description: 'Prépare la suppression DÉFINITIVE d\'une fiche entière. À n\'utiliser que sur un ordre explicite de l\'utilisateur, jamais de ta propre initiative. Renvoie un résumé à faire confirmer.', parameters: { type: 'OBJECT', properties: { id_fiche: { type: 'STRING' } }, required: ['id_fiche'] } },
    { name: 'oublier', description: 'Supprime de ta mémoire les éléments contenant ce texte.', parameters: { type: 'OBJECT', properties: { contient: { type: 'STRING' } }, required: ['contient'] } },
    { name: 'annuler_action', description: 'Annule l\'action préparée.', parameters: { type: 'OBJECT', properties: { id_confirmation: { type: 'STRING' } }, required: ['id_confirmation'] } }
  ];
  const OUTILS_LOCAUX = ['ou_suis_je', 'ouvrir_fiche', 'aller_onglet'];
  const ONGLETS = { accueil: 0, dashboard: 1, 'tableau de bord': 1, agenda: 2, prospects: 3, prospect: 3, rechercher: 4, recherche: 4, secteur: 4, leads: 5, lead: 5, clients: 6, client: 6, parametres: 7, params: 7, reglages: 7, salon: 8 };

  // ----- État -----
  let MEMOIRE = null, MODELE = null, JETON_PRET = null;
  let FLUX = null, WS = null, CTX = null, PROC = null, SRC = null;
  let tempsLecture = 0, sources = [], texteMoi = '', texteElle = '';
  let DEBUT_SESSION = null, TRANSCRIPT = [];
  let etat = 'off'; // off | connexion | on
  const CARTES_ATTENTE = {};
  try { MODELE = localStorage.getItem('modele_live') || null; } catch (e) {}

  function token() { try { return (typeof SESSION !== 'undefined' && SESSION && SESSION.token) || null; } catch (e) { return null; } }
  function sansAccent(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  async function api(corps) {
    const r = await fetch(URL_API, { method: 'POST', body: JSON.stringify(corps) });
    return await r.json();
  }
  function journal(resultat, detail) {
    const t = token(); if (!t) return;
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'log', etape: 'SIA dans Prospect', resultat, detail, token: t }) }).catch(() => {});
  }

  // ----- Interface -----
  const css = document.createElement('style');
  css.textContent = `
  #sia-btn{position:fixed;z-index:100000;width:58px;height:58px;border-radius:50%;background:#1a8a7a;box-shadow:0 4px 16px rgba(0,0,0,.28);display:none;align-items:center;justify-content:center;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;border:3px solid #fff}
  #sia-btn.sia-off{background:#8E8E93}
  #sia-btn.sia-connexion{background:#FF9500}
  #sia-btn.sia-on{background:#1a8a7a;animation:sia-pulse 1.8s infinite}
  @keyframes sia-pulse{0%{box-shadow:0 0 0 0 rgba(26,138,122,.55)}70%{box-shadow:0 0 0 14px rgba(26,138,122,0)}100%{box-shadow:0 0 0 0 rgba(26,138,122,0)}}
  #sia-btn svg{width:26px;height:26px;fill:#fff;pointer-events:none}
  #sia-stop{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;background:#FF3B30;border:2px solid #fff;display:none;align-items:center;justify-content:center}
  #sia-stop i{width:9px;height:9px;background:#fff;border-radius:2px;display:block}
  #sia-btn.sia-on #sia-stop,#sia-btn.sia-connexion #sia-stop{display:flex}
  #sia-panel{position:fixed;z-index:99999;width:min(360px,92vw);max-height:62vh;background:#fff;border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;color:#1C1C1E}
  #sia-panel.sia-ouvert{display:flex}
  #sia-tete{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1a8a7a;color:#fff}
  #sia-tete b{font-size:16px}
  #sia-statut{flex:1;font-size:12px;opacity:.9}
  #sia-tete button{background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:4px 10px;font-size:14px;cursor:pointer}
  #sia-conv{flex:1;overflow-y:auto;padding:10px;min-height:120px;background:#F2F2F7}
  .sia-msg{padding:8px 12px;border-radius:12px;margin-bottom:8px;max-width:90%;line-height:1.35;word-break:break-word}
  .sia-moi{background:#D4EDDA;margin-left:auto}
  .sia-elle{background:#fff}
  .sia-outil{background:#fff;border:1px solid #D1D1D6;max-width:100%}
  .sia-attente{border:2px solid #1a8a7a}
  .sia-titre{font-weight:700;margin-bottom:3px}
  .sia-ligne{font-size:13px;color:#3A3A3C}
  .sia-err{color:#FF3B30;font-size:13px}
  .sia-msg button{margin:8px 8px 0 0;padding:8px 14px;border:none;border-radius:10px;background:#1a8a7a;color:#fff;font-weight:600;font-size:14px;cursor:pointer}
  .sia-msg button.sia-rouge{background:#FF3B30}
  .sia-msg button:disabled{background:#AEAEB2}
  #sia-pied{padding:8px 10px;background:#fff;border-top:1px solid #E5E5EA;display:flex;gap:8px}
  #sia-pied button{flex:1;padding:11px;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer;color:#fff;background:#1a8a7a}
  #sia-pied button.sia-rouge{background:#FF3B30}`;
  document.head.appendChild(css);

  const btn = document.createElement('div');
  btn.id = 'sia-btn'; btn.className = 'sia-off';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg><div id="sia-stop" title="Arrêter SIA"><i></i></div>';
  document.body.appendChild(btn);

  const panneau = document.createElement('div');
  panneau.id = 'sia-panel';
  panneau.innerHTML = '<div id="sia-tete"><b>SIA</b><span id="sia-statut">Hors ligne</span><button id="sia-reduire" title="Réduire">–</button></div><div id="sia-conv"></div><div id="sia-pied"></div>';
  document.body.appendChild(panneau);
  const $conv = panneau.querySelector('#sia-conv'), $statut = panneau.querySelector('#sia-statut'), $pied = panneau.querySelector('#sia-pied');
  const $stop = btn.querySelector('#sia-stop');

  function el(tag, classe, texte) { const e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function statut(t) { $statut.textContent = t; }
  function majEtat(e) {
    etat = e;
    btn.classList.remove('sia-off', 'sia-connexion', 'sia-on');
    btn.classList.add('sia-' + e);
    $pied.innerHTML = '';
    const b = el('button', e === 'off' ? '' : 'sia-rouge', e === 'off' ? '🎙️ Parler avec SIA' : 'Terminer');
    b.onclick = e === 'off' ? demarrer : arreter;
    $pied.appendChild(b);
  }
  function ouvrirPanneau() { panneau.classList.add('sia-ouvert'); positionner(); }
  function fermerPanneau() { panneau.classList.remove('sia-ouvert'); }
  panneau.querySelector('#sia-reduire').onclick = fermerPanneau;

  // Bouton déplaçable (souris et doigt) ; la position est mémorisée sur l'appareil.
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem('sia_pos') || 'null'); } catch (e) {}
  function appliquerPos() {
    const w = window.innerWidth, h = window.innerHeight;
    let x = pos ? pos.x : w - 76, y = pos ? pos.y : h - 150;
    x = Math.max(6, Math.min(w - 64, x)); y = Math.max(6, Math.min(h - 64, y));
    btn.style.left = x + 'px'; btn.style.top = y + 'px';
    return { x, y };
  }
  function positionner() {
    const p = appliquerPos(), w = window.innerWidth, h = window.innerHeight;
    const larg = Math.min(360, w * 0.92);
    let gauche = Math.max(8, Math.min(w - larg - 8, p.x + 58 - larg));
    panneau.style.left = gauche + 'px';
    const enBas = p.y > h / 2;
    if (enBas) { panneau.style.top = 'auto'; panneau.style.bottom = (h - p.y + 8) + 'px'; }
    else { panneau.style.bottom = 'auto'; panneau.style.top = (p.y + 66) + 'px'; }
  }
  window.addEventListener('resize', () => { appliquerPos(); if (panneau.classList.contains('sia-ouvert')) positionner(); });
  let dragging = false, moved = false, dx = 0, dy = 0, sx = 0, sy = 0;
  btn.addEventListener('pointerdown', e => {
    if (e.target.closest('#sia-stop')) return;
    dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
    const r = btn.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 8) moved = true;
    if (moved) { pos = { x: e.clientX - dx, y: e.clientY - dy }; appliquerPos(); if (panneau.classList.contains('sia-ouvert')) positionner(); }
  });
  btn.addEventListener('pointerup', e => {
    if (!dragging) return; dragging = false;
    if (moved) { try { localStorage.setItem('sia_pos', JSON.stringify(pos)); } catch (er) {} return; }
    if (etat === 'off') { ouvrirPanneau(); demarrer(); }            // 1er clic : elle démarre (geste utilisateur => micro OK)
    else if (panneau.classList.contains('sia-ouvert')) fermerPanneau();
    else ouvrirPanneau();
  });
  $stop.addEventListener('pointerdown', e => e.stopPropagation());
  $stop.addEventListener('click', e => { e.stopPropagation(); arreter(); });

  // Visible seulement une fois connecté à Prospect.
  setInterval(() => { btn.style.display = token() ? 'flex' : 'none'; if (!token()) fermerPanneau(); }, 1000);
  appliquerPos(); majEtat('off');

  // ----- Conversation -----
  function ajouterCarte(noeud) { $conv.appendChild(noeud); $conv.scrollTop = $conv.scrollHeight; }
  function ajouterMessage(classe, texte) {
    TRANSCRIPT.push({ qui: classe, texte: texte });
    ajouterCarte(el('div', 'sia-msg sia-' + classe, texte));
  }
  function ecranActif() { const s = document.querySelector('.screen.active'); return s ? s.id : 'screen-home'; }

  function carteFiche(f) {
    const c = el('div', 'sia-msg sia-outil');
    c.appendChild(el('div', 'sia-titre', f.nom || 'Fiche'));
    [f.ville ? (f.code_postal ? f.code_postal + ' ' : '') + f.ville : '', f.decideur, f.telephone, f.email,
      f.date_rdv ? 'RDV ' + f.date_rdv + (f.heure_rdv ? ' à ' + f.heure_rdv : '') : ''].filter(Boolean)
      .forEach(t => c.appendChild(el('div', 'sia-ligne', t)));
    const b = el('button', '', 'Ouvrir la fiche');
    b.onclick = () => { const r = ouvrirFiche(f.id); if (!r.ok) c.appendChild(el('div', 'sia-err', r.erreur)); };
    c.appendChild(b);
    return c;
  }
  function afficherResultatOutil(nom, args, res) {
    if (!res || res.ok === false) { if (res && res.erreur && OUTILS_LOCAUX.indexOf(nom) === -1) ajouterCarte(el('div', 'sia-msg sia-outil sia-err', res.erreur)); return; }
    if (res.fiches) res.fiches.slice(0, 3).forEach(f => ajouterCarte(carteFiche(f)));
    else if (res.fiche) ajouterCarte(carteFiche(res.fiche));
    else if (res.evenements) {
      const c = el('div', 'sia-msg sia-outil'); c.appendChild(el('div', 'sia-titre', 'Agenda (' + res.jours + ' jours)'));
      if (!res.evenements.length) c.appendChild(el('div', 'sia-ligne', 'Rien de prévu.'));
      res.evenements.forEach(e => c.appendChild(el('div', 'sia-ligne', e.texte)));
      ajouterCarte(c);
    } else if (res.en_attente_de_confirmation) {
      if (nom === 'confirmer_action' && args && args.id_confirmation) cloreCarte(args.id_confirmation, '1re confirmation ✓');
      const c = el('div', 'sia-msg sia-outil sia-attente');
      c.appendChild(el('div', 'sia-titre', 'À confirmer'));
      c.appendChild(el('div', 'sia-ligne', res.resume));
      const b1 = el('button', '', 'Confirmer'), b2 = el('button', 'sia-rouge', 'Annuler');
      b1.onclick = () => decider(res.id_confirmation, true);
      b2.onclick = () => decider(res.id_confirmation, false);
      c.appendChild(b1); c.appendChild(b2);
      CARTES_ATTENTE[res.id_confirmation] = c;
      ajouterCarte(c);
    } else if (nom === 'confirmer_action' || nom === 'annuler_action') {
      cloreCarte(args && args.id_confirmation, nom === 'confirmer_action' ? '✓ ' + res.message : 'Annulé');
      if (nom === 'confirmer_action') { chargerMemoire(); rafraichirProspect(); }
    }
  }
  function cloreCarte(idConf, texte) {
    const c = CARTES_ATTENTE[idConf]; if (!c) return;
    c.querySelectorAll('button').forEach(b => b.remove());
    c.appendChild(el('div', 'sia-ligne', texte));
    delete CARTES_ATTENTE[idConf];
  }
  // Après une écriture : recharge les fiches de Prospect et remet la fiche ouverte à jour.
  function rafraichirProspect() {
    try {
      if (typeof loadData !== 'function') return;
      loadData(false, () => {
        try {
          const ouverte = document.getElementById('screen-fiche') && document.getElementById('screen-fiche').classList.contains('active');
          if (ouverte && currentProspect) showFiche(currentProspect.id, prevScreen);
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ----- Outils qui pilotent l'écran (exécutés dans la page, sans passer par le serveur) -----
  function ouvrirFiche(id) {
    try {
      const p = (typeof PROSPECTS !== 'undefined' ? PROSPECTS : []).find(x => x.id === String(id));
      if (!p) return { ok: false, erreur: 'Fiche introuvable parmi tes fiches chargées' };
      showFiche(p.id, ecranActif() === 'screen-fiche' ? prevScreen : ecranActif());
      return { ok: true, message: 'Fiche ouverte : ' + p.nom };
    } catch (e) { return { ok: false, erreur: e.message }; }
  }
  function outilLocal(nom, args) {
    if (nom === 'ou_suis_je') {
      let fiche = null; try { if (currentProspect && ecranActif() === 'screen-fiche') fiche = { id: currentProspect.id, nom: currentProspect.nom }; } catch (e) {}
      return { ok: true, ecran: ecranActif(), fiche_ouverte: fiche };
    }
    if (nom === 'ouvrir_fiche') return ouvrirFiche(args && args.id);
    if (nom === 'aller_onglet') {
      const i = ONGLETS[sansAccent(args && args.nom)];
      if (i === undefined) return { ok: false, erreur: 'Onglet inconnu. Onglets : Accueil, Dashboard, Agenda, Prospects, Rechercher, Leads, Clients, Paramètres, Salon' };
      try { showTab(i); return { ok: true, message: 'Onglet ouvert : ' + args.nom }; } catch (e) { return { ok: false, erreur: e.message }; }
    }
    return { ok: false, erreur: 'Outil local inconnu' };
  }
  async function appelerOutil(nom, args) {
    if (OUTILS_LOCAUX.indexOf(nom) !== -1) return outilLocal(nom, args || {});
    try {
      const r = await api({ action: 'outil', nom, args: args || {}, token: token() });
      return r.ok ? r.donnees : { ok: false, erreur: r.erreur || 'Erreur serveur' };
    } catch (e) { return { ok: false, erreur: e.message }; }
  }
  async function traiterAppelsOutils(appels) {
    const reponses = [];
    for (const a of appels) {
      const res = await appelerOutil(a.name, a.args);
      if (a.name === 'proposer_idee' && res.ok !== false) ajouterCarte(el('div', 'sia-msg sia-outil', '💡 Idée notée : ' + (a.args && a.args.titre || '')));
      if (a.name === 'retenir' || a.name === 'oublier') { chargerMemoire(); if (res.ok !== false) ajouterCarte(el('div', 'sia-msg sia-outil', a.name === 'retenir' ? '🧠 Retenu : ' + (a.args && a.args.contenu || '') : '🧠 Oublié (' + res.supprimes + ')')); }
      afficherResultatOutil(a.name, a.args, res);
      reponses.push({ id: a.id, name: a.name, response: res });
    }
    if (WS && WS.readyState === 1) WS.send(JSON.stringify({ toolResponse: { functionResponses: reponses } }));
  }
  async function decider(idConf, oui) {
    const c = CARTES_ATTENTE[idConf];
    if (c) c.querySelectorAll('button').forEach(b => b.disabled = true);
    const res = await appelerOutil(oui ? 'confirmer_action' : 'annuler_action', { id_confirmation: idConf });
    if (oui && res.en_attente_de_confirmation) afficherResultatOutil('confirmer_action', { id_confirmation: idConf }, res);
    else {
      cloreCarte(idConf, oui ? (res.ok === false ? 'Échec : ' + res.erreur : '✓ ' + res.message) : 'Annulé');
      if (oui && res.ok !== false) { chargerMemoire(); rafraichirProspect(); }
    }
    if (WS && WS.readyState === 1) WS.send(JSON.stringify({ realtimeInput: { text: oui ? '[Écran] L\'utilisateur a confirmé avec le bouton. Résultat : ' + JSON.stringify(res) : '[Écran] L\'utilisateur a annulé avec le bouton.' } }));
  }

  // ----- Mémoire, consigne, jeton -----
  function consigneDuJour() {
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    const m = MEMOIRE || {};
    const persona = m.base && m.base.trim() ? IDENTITE + m.base.trim() : IDENTITE + PERSONA_DEFAUT;
    let mem = '';
    if (m.profil) mem += ' Profil de cet utilisateur (à respecter) : ' + m.profil.replace(/\n/g, ' ') + '.';
    if (m.long_terme) mem += ' Mémoire long terme : ' + m.long_terme.replace(/\n/g, ' ') + '.';
    if (m.historique) mem += ' Tes dernières sessions avec lui : ' + m.historique.replace(/\n/g, ' ') + '.';
    if (m.skills) mem += ' Index de tes skills : ' + m.skills.replace(/\n/g, ' ; ') + '.';
    let ctxe = ' Écran actuel : ' + ecranActif() + '.';
    try { if (currentProspect && ecranActif() === 'screen-fiche') ctxe += ' Fiche ouverte : ' + currentProspect.nom + ' (id ' + currentProspect.id + ').'; } catch (e) {}
    return persona + ' Nous sommes le ' + d + '.' + ctxe + ' ' + REGLES_OUTILS + REGLES_ECRAN + REGLES_MEMOIRE + REGLES_SKILLS + mem;
  }
  async function chargerMemoire() {
    try { const r = await api({ action: 'memoire', token: token() }); if (r.ok) MEMOIRE = r.donnees; } catch (e) {}
  }
  async function preparer() {
    chargerMemoire();
    try {
      if (!MODELE) {
        const m = await api({ action: 'modeles', token: token() });
        if (!m.ok) return;
        const vocaux = m.donnees.live.filter(n => !/transcribe|translate|robotics|extended/.test(n));
        MODELE = vocaux.find(n => /3\.8-live$/.test(n)) || vocaux.find(n => /3\.1-flash-live/.test(n)) || vocaux.find(n => /native-audio-latest/.test(n)) || vocaux[0] || null;
        if (MODELE) { try { localStorage.setItem('modele_live', MODELE); } catch (e) {} }
      }
      if (!MODELE) return;
      const t = await api({ action: 'jeton', modele: MODELE, token: token() });
      if (t.ok) JETON_PRET = { jeton: t.donnees, quand: Date.now() };
    } catch (e) {}
  }
  async function obtenirJeton() {
    if (JETON_PRET && Date.now() - JETON_PRET.quand < 8 * 60 * 1000) { const j = JETON_PRET.jeton; JETON_PRET = null; return j; }
    JETON_PRET = null;
    if (!MODELE) await preparer();
    if (!MODELE) throw new Error('Aucun modèle vocal disponible');
    const t = await api({ action: 'jeton', modele: MODELE, token: token() });
    if (!t.ok) throw new Error(t.erreur);
    return t.donnees;
  }
  // Prépare modèle, mémoire et jeton dès que la connexion à Prospect existe.
  let prepare = false;
  setInterval(() => { if (token() && !prepare) { prepare = true; preparer(); } if (!token()) prepare = false; }, 1500);

  function cloturerSession() {
    const t = token();
    if (!DEBUT_SESSION || !t) { DEBUT_SESSION = null; return; }
    const corps = JSON.stringify({ action: 'cloturer_session', token: t, debut: DEBUT_SESSION.toISOString(), fin: new Date().toISOString(), transcript: TRANSCRIPT });
    DEBUT_SESSION = null; TRANSCRIPT = [];
    try { fetch(URL_API, { method: 'POST', body: corps, keepalive: true }).then(() => chargerMemoire()).catch(() => {}); } catch (e) {}
  }
  window.addEventListener('pagehide', cloturerSession);

  // ----- Audio -----
  function versB64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function depuisB64(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

  async function demarrer() {
    if (etat !== 'off') return;
    majEtat('connexion'); statut('Autorisation du micro...');
    ouvrirPanneau();
    try {
      // iOS : son + micro doivent être demandés directement dans le geste tactile.
      CTX = new (window.AudioContext || window.webkitAudioContext)(); CTX.resume();
      FLUX = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      journal('OK', 'micro autorisé');
      statut('Connexion...');
      const jeton = await obtenirJeton();
      const mVoix = MEMOIRE && MEMOIRE.profil ? MEMOIRE.profil.match(/^- Voix : (\w+)/m) : null;
      const voix = mVoix && ['Sulafat', 'Aoede', 'Kore'].indexOf(mVoix[1]) !== -1 ? mVoix[1] : 'Sulafat';
      tempsLecture = 0; sources = [];
      WS = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=' + encodeURIComponent(jeton));
      WS.onopen = () => {
        WS.send(JSON.stringify({ setup: {
          model: MODELE,
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
          systemInstruction: { parts: [{ text: consigneDuJour() }] },
          tools: [{ functionDeclarations: OUTILS }],
          inputAudioTranscription: {}, outputAudioTranscription: {}
        } }));
      };
      WS.onerror = () => { statut('Erreur de connexion vocale'); };
      WS.onclose = ev => {
        journal(ev.code === 1000 ? 'OK' : 'ÉCHEC', 'connexion fermée code ' + ev.code + ' ' + (ev.reason || ''));
        if (ev.code !== 1000) ajouterCarte(el('div', 'sia-msg sia-outil sia-err', 'Connexion fermée (code ' + ev.code + ') ' + (ev.reason || '')));
        nettoyer();
      };
      WS.onmessage = async ev => {
        let txt = ev.data; if (txt instanceof Blob) txt = await txt.text();
        const m = JSON.parse(txt);
        if (m.setupComplete) { DEBUT_SESSION = new Date(); TRANSCRIPT = []; majEtat('on'); statut('Je t\'écoute'); demarrerMicro(); }
        if (m.toolCall && m.toolCall.functionCalls) { traiterAppelsOutils(m.toolCall.functionCalls); return; }
        const sc = m.serverContent; if (!sc) return;
        if (sc.interrupted) { sources.forEach(s => { try { s.stop(); } catch (e) {} }); sources = []; tempsLecture = 0; }
        const parts = sc.modelTurn && sc.modelTurn.parts;
        if (parts) parts.forEach(p => { if (p.inlineData && p.inlineData.data) jouer(p.inlineData.data); });
        if (sc.inputTranscription && sc.inputTranscription.text) texteMoi += sc.inputTranscription.text;
        if (sc.outputTranscription && sc.outputTranscription.text) {
          if (texteMoi.trim()) { ajouterMessage('moi', texteMoi.trim()); journal('info', 'Moi : ' + texteMoi.trim()); texteMoi = ''; }
          texteElle += sc.outputTranscription.text;
        }
        if (sc.turnComplete) {
          if (texteMoi.trim()) { ajouterMessage('moi', texteMoi.trim()); texteMoi = ''; }
          if (texteElle.trim()) { ajouterMessage('elle', texteElle.trim()); journal('info', 'Elle : ' + texteElle.trim()); texteElle = ''; }
        }
      };
    } catch (e) {
      const msg = e && e.name === 'NotAllowedError' ? 'Micro refusé : autorise le micro pour ce site dans les réglages du navigateur.' : (e && e.message ? e.message : String(e));
      ajouterCarte(el('div', 'sia-msg sia-outil sia-err', msg));
      journal('ÉCHEC', msg);
      MODELE = null; try { localStorage.removeItem('modele_live'); } catch (e2) {}
      nettoyer();
    }
  }
  function demarrerMicro() {
    SRC = CTX.createMediaStreamSource(FLUX);
    PROC = CTX.createScriptProcessor(4096, 1, 1);
    const rapport = CTX.sampleRate / 16000;
    PROC.onaudioprocess = e => {
      if (!WS || WS.readyState !== 1) return;
      const entree = e.inputBuffer.getChannelData(0);
      const n = Math.floor(entree.length / rapport);
      const pcm = new Int16Array(n);
      for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, entree[Math.floor(i * rapport)])); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7FFF; }
      WS.send(JSON.stringify({ realtimeInput: { audio: { data: versB64(pcm.buffer), mimeType: 'audio/pcm;rate=16000' } } }));
    };
    SRC.connect(PROC); PROC.connect(CTX.destination);
  }
  function jouer(b64) {
    const pcm = new Int16Array(depuisB64(b64));
    const buf = CTX.createBuffer(1, pcm.length, 24000);
    const c = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) c[i] = pcm[i] / 0x8000;
    const s = CTX.createBufferSource(); s.buffer = buf; s.connect(CTX.destination);
    tempsLecture = Math.max(tempsLecture, CTX.currentTime);
    s.start(tempsLecture); tempsLecture += buf.duration;
    sources.push(s); s.onended = () => { sources = sources.filter(x => x !== s); };
  }
  function nettoyer() {
    cloturerSession();
    try { if (PROC) PROC.disconnect(); if (SRC) SRC.disconnect(); } catch (e) {}
    try { if (FLUX) FLUX.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (CTX) CTX.close(); } catch (e) {}
    PROC = SRC = FLUX = CTX = WS = null;
    majEtat('off'); statut('Hors ligne');
    if (token()) preparer();
  }
  function arreter() { try { if (WS) WS.close(1000); } catch (e) {} nettoyer(); }

  window.SIA = {
    ouvrir() { ouvrirPanneau(); if (etat === 'off') demarrer(); },
    arreter,
    actif() { return etat !== 'off'; },
    outilLocal // exposé pour les tests
  };
})();
