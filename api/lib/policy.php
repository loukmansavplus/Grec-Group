<?php
// Droits d'accès : portage fidèle de firestore.rules (testé par api/tests/run.mjs, mêmes 25 contrôles qu'avec Firebase).
// $uid = utilisateur connecté (ou null pour un visiteur).

function is_admin_uid($uid)
{
    if (!$uid) return false;
    $a = doc_get('admins', $uid);
    return $a !== null && !(isset($a['active']) && $a['active'] === false);
}

function is_active_member_uid($uid)
{
    if (!$uid) return false;
    if (is_admin_uid($uid)) return true;
    $m = doc_get('membres', $uid);
    return $m !== null && isset($m['statut']) && $m['statut'] === 'actif';
}

function top_collection($coll)
{
    $p = explode('/', $coll);
    return $p[0];
}

function is_messages_coll($coll)
{
    return preg_match('#^chats/[^/]+/messages$#', $coll) === 1;
}

function chat_participants($chatId)
{
    $c = doc_get('chats', $chatId);
    return ($c !== null && isset($c['participants']) && is_array($c['participants'])) ? $c['participants'] : null;
}

function where_has($where, $field, $value)
{
    foreach ($where as $w) {
        if ($w[0] === $field && $w[1] === '==' && $w[2] === $value) return true;
    }
    return false;
}

// Lecture d'un document (get) ou d'un résultat de liste : $data = contenu (null si le document n'existe pas).
function can_read_doc($coll, $id, $data, $uid)
{
    if (is_messages_coll($coll)) {
        if (!$uid) return false;
        $parts = chat_participants(explode('/', $coll)[1]);
        return $parts !== null && in_array($uid, $parts, true);
    }
    $top = top_collection($coll);
    switch ($top) {
        case 'membres':
            return $uid && ($uid === $id || is_active_member_uid($uid));
        case 'annuaire': case 'galerie': case 'partenaires':
            return true;
        case 'admins':
            return $uid && ($uid === $id || is_admin_uid($uid));
        case 'ACTION_LOG': case 'newsletter': case 'contacts':
            return is_admin_uid($uid);
        case 'actualites': case 'evenements':
            if ($data === null) return true; // document inexistant : lecture sans objet
            return (isset($data['publie']) && $data['publie'] === true) || is_admin_uid($uid) || ($uid && isset($data['authorUid']) && $data['authorUid'] === $uid);
        case 'contributions':
            if ($data === null) return is_admin_uid($uid);
            return is_admin_uid($uid) || ($uid && isset($data['authorUid']) && $data['authorUid'] === $uid);
        case 'chats':
            if (!$uid) return false;
            if ($data === null) return true; // test d'existence avant création
            return isset($data['participants']) && is_array($data['participants']) && in_array($uid, $data['participants'], true);
    }
    return false;
}

// Liste : les contraintes de la requête doivent garantir que tous les résultats sont lisibles (comme Firestore).
function can_list($coll, $where, $uid)
{
    if (is_messages_coll($coll)) return can_read_doc($coll, null, null, $uid);
    $top = top_collection($coll);
    switch ($top) {
        case 'membres': return is_active_member_uid($uid);
        case 'annuaire': case 'galerie': case 'partenaires': return true;
        case 'admins': case 'ACTION_LOG': case 'newsletter': case 'contacts': return is_admin_uid($uid);
        case 'actualites': case 'evenements':
            return is_admin_uid($uid) || where_has($where, 'publie', true) || ($uid && where_has($where, 'authorUid', $uid));
        case 'contributions':
            return is_admin_uid($uid) || ($uid && where_has($where, 'authorUid', $uid));
        case 'chats':
            if (!$uid) return false;
            foreach ($where as $w) {
                if ($w[0] === 'participants' && $w[1] === 'array-contains' && $w[2] === $uid) return true;
            }
            return false;
    }
    return false;
}

function keys_subset($data, $allowed)
{
    foreach (array_keys($data) as $k) if (!in_array($k, $allowed, true)) return false;
    return true;
}

// Écriture : $op = create | update | delete ; $old = document existant (ou null) ; $new = document résultant (ou null).
function can_write($op, $coll, $id, $old, $new, $uid)
{
    if (is_messages_coll($coll)) {
        if ($op !== 'create' || !$uid) return false;
        $parts = chat_participants(explode('/', $coll)[1]);
        return is_active_member_uid($uid) && $parts !== null && in_array($uid, $parts, true)
            && isset($new['senderId']) && $new['senderId'] === $uid
            && isset($new['text']) && is_string($new['text']) && mb_strlen($new['text']) > 0 && mb_strlen($new['text']) <= 2000;
    }
    $top = top_collection($coll);
    $admin = is_admin_uid($uid);
    switch ($top) {
        case 'membres':
            if ($op === 'create') return $admin || ($uid && $uid === $id && isset($new['role']) && $new['role'] === 'membre' && isset($new['statut']) && $new['statut'] === 'en_attente');
            if ($op === 'update') return $admin || ($uid && $uid === $id && (isset($new['role']) ? $new['role'] : null) === (isset($old['role']) ? $old['role'] : null) && (isset($new['statut']) ? $new['statut'] : null) === (isset($old['statut']) ? $old['statut'] : null));
            return $admin || ($uid && $uid === $id); // delete
        case 'annuaire':
            if ($op === 'delete') return $admin || ($uid && $uid === $id);
            if ($admin) return true;
            if (!($uid && $uid === $id && is_active_member_uid($uid))) return false;
            $m = doc_get('membres', $uid);
            if (!($m !== null && isset($m['publicProfileEnabled']) && $m['publicProfileEnabled'] === true)) return false;
            return keys_subset($new, array('nom', 'secteur', 'pays', 'ville', 'poste', 'bio', 'photoURL', 'showPhoto', 'showBio', 'showLocation', 'createdAt', 'updatedAt'));
        case 'admins': case 'galerie': case 'partenaires': case 'actualites': case 'evenements':
            return $admin;
        case 'ACTION_LOG':
            return $op === 'create' && $admin;
        case 'contributions':
            if ($op === 'create') {
                return is_active_member_uid($uid) && isset($new['authorUid']) && $new['authorUid'] === $uid
                    && isset($new['validationStatus']) && $new['validationStatus'] === 'en_attente'
                    && isset($new['publie']) && $new['publie'] === false
                    && isset($new['type']) && in_array($new['type'], array('article', 'event'), true);
            }
            if ($op === 'update') return $admin;
            return $admin || ($uid && isset($old['authorUid']) && $old['authorUid'] === $uid && isset($old['validationStatus']) && $old['validationStatus'] === 'en_attente');
        case 'newsletter':
            if ($op === 'create') return keys_subset($new, array('email', 'subscribedAt')) && isset($new['email']) && valid_email($new['email']);
            return $admin;
        case 'contacts':
            if ($op === 'create') {
                return keys_subset($new, array('nom', 'email', 'message', 'createdAt', 'source'))
                    && isset($new['nom']) && is_string($new['nom']) && mb_strlen($new['nom']) <= 120
                    && isset($new['email']) && is_string($new['email']) && mb_strlen($new['email']) <= 254
                    && isset($new['message']) && is_string($new['message']) && mb_strlen($new['message']) <= 5000;
            }
            return $admin;
        case 'chats':
            if (!$uid) return false;
            if ($op === 'create') {
                return is_active_member_uid($uid) && isset($new['participants']) && is_array($new['participants']) && count($new['participants']) === 2 && in_array($uid, $new['participants'], true);
            }
            if ($op === 'update') {
                return isset($old['participants']) && in_array($uid, $old['participants'], true) && (isset($new['participants']) ? $new['participants'] : null) === $old['participants'];
            }
            return false;
    }
    return false;
}
