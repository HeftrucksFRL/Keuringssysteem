<?php
/**
 * Plugin Name: Heftruckopleiding – agenda voor keuringsapp
 * Description: Beperkte, alleen-lezen cursuskoppeling voor één geselecteerde instructeur.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * Requires at least: 6.4
 * Author: Heftrucks Friesland
 */
declare(strict_types=1);
if (!defined('ABSPATH')) { exit; }

final class HF_Keuring_Course_Agenda {
    private const OPTION = 'hf_keuring_course_agenda';
    public static function register(): void {
        add_action('admin_menu', static function(): void {
            add_options_page('Keuringsagenda', 'Keuringsagenda', 'manage_options', 'hf-keuringsagenda', array(self::class,'settings'));
        });
        add_action('rest_api_init', static function(): void {
            register_rest_route('heftruckopleiding-keuring/v1','/courses',array(
                'methods'=>'GET','callback'=>array(self::class,'courses'),'permission_callback'=>array(self::class,'allowed')
            ));
        });
    }
    public static function allowed(WP_REST_Request $request) {
        $config=get_option(self::OPTION,array());
        $header=(string)$request->get_header('authorization');
        if (empty($config['instructor_id']) || empty($config['token_hash']) || !preg_match('/^Bearer ([a-f0-9]{64})$/D',$header,$match) || !hash_equals((string)$config['token_hash'],hash('sha256',$match[1]))) {
            return new WP_Error('hf_agenda_denied','Geen toegang tot deze agenda.',array('status'=>401));
        }
        return true;
    }
    public static function settings(): void {
        if(!current_user_can('manage_options')) { return; }
        $config=get_option(self::OPTION,array());$token='';$message='';
        if (isset($_POST['hf_agenda_save'])) {
            check_admin_referer('hf_agenda_save');
            $id=absint($_POST['instructor_id']??0);$user=get_user_by('id',$id);
            if(isset($_POST['disable'])) {
                delete_option(self::OPTION);$config=array();$message='Koppeling uitgeschakeld. De oude sleutel is ongeldig.';
            } elseif(!$user || !array_intersect(array('hp_instructor','hp_planner'),$user->roles)) {
                $message='Kies Age uit de instructeurslijst.';
            } else {
                $token=bin2hex(random_bytes(32));
                $config=array('instructor_id'=>$id,'token_hash'=>hash('sha256',$token));
                update_option(self::OPTION,$config,false);
                $message='Koppeling ingesteld. Kopieer de sleutel nu; hij wordt maar één keer getoond. Een eerdere sleutel is direct ongeldig.';
            }
        }
        echo '<div class="wrap"><h1>Cursusagenda voor de keuringsapp</h1>';
        if(!defined('HP_PLANNING_VERSION')) { echo '<div class="notice notice-error"><p>Activeer eerst Heftruckopleiding Planning &amp; Certificering.</p></div>'; }
        echo '<p>Selecteer <strong>Age</strong>. Alleen cursussen die aan deze instructeur zijn gekoppeld, worden aan de keuringsapp geleverd. Deelnemers, andere instructeurs en overige afspraken worden niet meegestuurd.</p>';
        if($message) { echo '<div class="notice notice-info"><p>'.esc_html($message).'</p></div>'; }
        echo '<form method="post">';wp_nonce_field('hf_agenda_save');
        echo '<label for="instructor_id">Instructeur</label> <select id="instructor_id" name="instructor_id"><option value="0">Kies Age</option>';
        foreach(get_users(array('role__in'=>array('hp_instructor','hp_planner'),'orderby'=>'display_name')) as $user) {
            echo '<option value="'.esc_attr((string)$user->ID).'" '.selected((int)($config['instructor_id']??0),$user->ID,false).'>'.esc_html($user->display_name).' (ID '.esc_html((string)$user->ID).')</option>';
        }
        echo '</select><p><button class="button button-primary" name="hf_agenda_save" value="1">Nieuwe sleutel maken voor deze instructeur</button></p>';
        if(!empty($config)) { echo '<p><label><input type="checkbox" name="disable" value="1"> Koppeling uitschakelen bij opslaan</label></p>'; }
        echo '</form>';
        if($token) {
            echo '<h2>Instellen in de hosting van de keuringsapp</h2><p>Voeg de volgende twee omgevingsvariabelen toe voor Production. Publiceer de app daarna opnieuw. Deel de sleutel niet via chat of e-mail.</p>';
            echo '<p><code>HEFTRUCK_COURSE_INSTRUCTOR_ID</code> = <code>'.esc_html((string)$config['instructor_id']).'</code></p>';
            echo '<label for="hf-agenda-token"><code>HEFTRUCK_COURSE_AGENDA_TOKEN</code></label><p><input id="hf-agenda-token" type="text" readonly autocomplete="off" class="large-text code" value="'.esc_attr($token).'"></p>';
        }
        echo '<p>De koppeling kan uitsluitend cursussen uitlezen en niets wijzigen. Geannuleerde, gearchiveerde en conceptcursussen worden uitgesloten. Als je de geselecteerde instructeur wilt wijzigen, maak je een nieuwe sleutel.</p></div>';
    }
    public static function courses(WP_REST_Request $request) {
        if(!defined('HP_PLANNING_VERSION')) { return new WP_Error('hf_agenda_unavailable','De cursusplanning is niet beschikbaar.',array('status'=>503)); }
        $from=$request->get_param('from');$to=$request->get_param('to');
        if(!is_string($from)||!is_string($to)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$from)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$to)) { return new WP_Error('hf_agenda_range','Ongeldige agendaperiode.',array('status'=>400)); }
        $zone=new DateTimeZone('Europe/Amsterdam');
        $first=DateTimeImmutable::createFromFormat('!Y-m-d',$from,$zone);$last=DateTimeImmutable::createFromFormat('!Y-m-d',$to,$zone);
        if(!$first||!$last||$first->format('Y-m-d')!==$from||$last->format('Y-m-d')!==$to||$last<$first||(int)$first->diff($last)->format('%a')>62) {
            return new WP_Error('hf_agenda_range','Ongeldige agendaperiode.',array('status'=>400));
        }
        $id=(int)(get_option(self::OPTION,array())['instructor_id']??0);$user=get_user_by('id',$id);
        if(!$user) { return new WP_Error('hf_agenda_instructor','De ingestelde instructeur bestaat niet meer.',array('status'=>503)); }
        global $wpdb;
        $utc=new DateTimeZone('UTC');
        $rows=$wpdb->get_results($wpdb->prepare(
            "SELECT id,title,starts_at,ends_at,location_resource,location_address FROM {$wpdb->prefix}hp_courses WHERE instructor_user_id=%d AND status IN ('planned','open','full','in_progress','completed') AND starts_at < %s AND ends_at > %s ORDER BY starts_at ASC LIMIT 1001",
            $id,$last->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s'),$first->setTimezone($utc)->format('Y-m-d H:i:s')
        ),ARRAY_A);
        if($wpdb->last_error||!is_array($rows)||count($rows)>1000) { return new WP_Error('hf_agenda_read','De cursussen konden niet volledig worden geladen.',array('status'=>503)); }
        $courses=array();
        try {
            foreach($rows as $row) {
                $start=new DateTimeImmutable((string)$row['starts_at'],$utc);$end=new DateTimeImmutable((string)$row['ends_at'],$utc);
                if($end<=$start) { throw new RuntimeException('invalid times'); }
                $courses[]=array('id'=>(string)$row['id'],'title'=>wp_strip_all_tags((string)$row['title']),
                    'startsAt'=>$start->format('Y-m-d\TH:i:s\Z'),'endsAt'=>$end->format('Y-m-d\TH:i:s\Z'),
                    'location'=>wp_strip_all_tags(implode(' · ',array_filter(array($row['location_resource'],$row['location_address'])))),
                    'instructorId'=>$id,'instructorName'=>$user->display_name);
            }
        } catch(Throwable $e) { return new WP_Error('hf_agenda_times','Een cursus heeft ongeldige tijden.',array('status'=>503)); }
        $response=new WP_REST_Response(array('instructorId'=>$id,'courses'=>$courses,'fetchedAt'=>gmdate('Y-m-d\TH:i:s\Z')));
        $response->header('Cache-Control','private, no-store');
        return $response;
    }
}
HF_Keuring_Course_Agenda::register();
