<?php
declare(strict_types=1);
define('ABSPATH','/');define('HP_PLANNING_VERSION','test');define('ARRAY_A','ARRAY_A');
$config=array('instructor_id'=>7,'token_hash'=>hash('sha256',str_repeat('a',64)));
function add_action(...$args) {}
function get_option(...$args) {global $config;return $config;}
function get_user_by(...$args) {return (object)array('display_name'=>'Age');}
function wp_strip_all_tags($text) {return strip_tags($text);}
class WP_Error {public $code;public function __construct($code,...$rest){$this->code=$code;}}
class WP_REST_Request {
 public $header;public $params;
 public function __construct($header,$params){$this->header=$header;$this->params=$params;}
 public function get_header($name){return $this->header;}
 public function get_param($name){return $this->params[$name]??null;}
}
class WP_REST_Response {public $data;public $headers=array();public function __construct($data){$this->data=$data;}public function header($name,$value){$this->headers[$name]=$value;}}
class FakeDB {
 public $prefix='wp_';public $last_error='';public $query='';public $args=array();
 public function prepare($query,...$args){$this->query=$query;$this->args=$args;return $query;}
 public function get_results(...$args){return array(array('id'=>12,'title'=>'<b>Heftruckcursus</b>','starts_at'=>'2026-11-12 08:00:00','ends_at'=>'2026-11-12 15:00:00','location_resource'=>'Sneek','location_address'=>'Voorbeeldweg 1'));}
}
$wpdb=new FakeDB();require '/plugin.php';
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$params=array('from'=>'2026-11-01','to'=>'2026-11-30');
foreach(array('','Bearer '.str_repeat('b',64),'Basic wrong') as $header)check(HF_Keuring_Course_Agenda::allowed(new WP_REST_Request($header,$params)) instanceof WP_Error,'invalid key accepted');
$request=new WP_REST_Request('Bearer '.str_repeat('a',64),$params);
check(HF_Keuring_Course_Agenda::allowed($request)===true,'valid key denied');
$result=HF_Keuring_Course_Agenda::courses($request);
check($result instanceof WP_REST_Response,'valid query denied');
check($wpdb->args[0]===7,'instructor not bound server-side');
check(strpos($wpdb->query,'WHERE instructor_user_id=%d')!==false,'instructor filter missing');
check(strpos($wpdb->query,"status IN ('planned','open','full','in_progress','completed')")!==false,'cancelled/draft filter missing');
check($wpdb->args[1]==='2026-11-30 23:00:00'&&$wpdb->args[2]==='2026-10-31 23:00:00','Amsterdam query boundaries incorrect');
$course=$result->data['courses'][0];
check($course['startsAt']==='2026-11-12T08:00:00Z','UTC changed');
check($course['title']==='Heftruckcursus','HTML not removed');
check(array_keys($course)===array('id','title','startsAt','endsAt','location','instructorId','instructorName'),'unexpected data exported');
check($result->headers['Cache-Control']==='private, no-store','cache protection missing');
foreach(array(array('from'=>'2026-02-30','to'=>'2026-03-01'),array('from'=>'2026-12-01','to'=>'2026-01-01'),array('from'=>'2026-01-01','to'=>'2026-12-31')) as $range)check(HF_Keuring_Course_Agenda::courses(new WP_REST_Request($request->header,$range)) instanceof WP_Error,'invalid range allowed');
$config=array();check(HF_Keuring_Course_Agenda::allowed($request) instanceof WP_Error,'revoked key allowed');
echo "PASS: token isolation, server instructor filter, course statuses, DST boundaries, output whitelist, invalid ranges, revoked access\n";
