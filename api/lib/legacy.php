<?php
// Reflet des membres dans l'ancienne table g_membre (même base) : les inscriptions, validations et suppressions
// faites sur le nouveau site restent visibles dans l'ancienne base. Ne fait jamais échouer l'opération principale.

function legacy_available()
{
    static $ok = null;
    if ($ok === null) {
        $c = cfg();
        if (empty($c['legacy_mirror'])) return $ok = false; // activé seulement dans la config du vrai site
        try { q('SELECT 1 FROM g_membre LIMIT 1'); $ok = true; } catch (Exception $e) { $ok = false; }
    }
    return $ok;
}

function legacy_clean($v, $max)
{
    return mb_substr(trim((string) $v), 0, $max);
}

// $data = document complet du membre après écriture. Retourne rien.
function legacy_mirror_member($uid, $data)
{
    try {
        if (!legacy_available() || !is_array($data)) return;
        $statut = (isset($data['statut']) && $data['statut'] === 'actif') ? 1 : 0;
        $f = array(
            legacy_clean(isset($data['nom']) ? $data['nom'] : '', 255), legacy_clean(isset($data['telephone']) ? $data['telephone'] : '', 30),
            legacy_clean(isset($data['email']) ? $data['email'] : '', 255), legacy_clean(isset($data['pays']) ? $data['pays'] : '', 100),
            legacy_clean(isset($data['secteur']) ? $data['secteur'] : '', 255), trim(isset($data['bio']) ? (string) $data['bio'] : ''), $statut,
        );
        $gid = isset($data['legacyId']) ? (int) $data['legacyId'] : 0;
        if ($gid > 0) {
            q('UPDATE g_membre SET nom_prenom = ?, phone = ?, email = ?, pays = ?, activite = ?, presentation = ?, statut = ? WHERE id_membre = ?', array_merge($f, array($gid)));
            return;
        }
        q("INSERT INTO g_membre (nom_prenom, phone, email, password, pays, activite, presentation, statut, datecreated) VALUES (?,?,?,'',?,?,?,?,NOW())",
            array($f[0], $f[1], $f[2], $f[3], $f[4], $f[5], $f[6]));
        $gid = (int) db()->lastInsertId();
        if ($gid > 0) { // mémorise le lien dans le document (écriture serveur directe)
            $data['legacyId'] = $gid;
            doc_put('membres', $uid, $data);
        }
    } catch (Exception $e) {
        error_log('GREC legacy mirror: ' . $e->getMessage());
    }
}

function legacy_delete_member($data)
{
    try {
        $gid = (is_array($data) && isset($data['legacyId'])) ? (int) $data['legacyId'] : 0;
        if ($gid > 0 && legacy_available()) q('DELETE FROM g_membre WHERE id_membre = ?', array($gid));
    } catch (Exception $e) {
        error_log('GREC legacy delete: ' . $e->getMessage());
    }
}
