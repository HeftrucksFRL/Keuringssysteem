import {test} from "node:test";
import assert from "node:assert/strict";
import {courseAgendaRangeSchema,courseOccurrences,courseLocalDate,validateCourseFeed} from "../lib/course-agenda";
const course={id:"12",title:"Heftruckcursus",startsAt:"2026-11-12T08:00:00Z",endsAt:"2026-11-12T15:00:00Z",location:"Sneek",instructorId:7,instructorName:"Age"};
const feed={instructorId:7,courses:[course],fetchedAt:"2026-11-12T10:00:00Z"};
test("course feed fails closed for wrong instructors, duplicates and unexpected participant data",()=>{
 assert.equal(validateCourseFeed(feed,7).courses.length,1);
 assert.throws(()=>validateCourseFeed(feed,8));
 assert.throws(()=>validateCourseFeed({...feed,courses:[{...course,instructorId:8,instructorName:"Sipke"}]},7));
 assert.throws(()=>validateCourseFeed({...feed,courses:[course,course]},7));
 assert.throws(()=>validateCourseFeed({...feed,courses:[{...course,participants:["Private name"]}]},7));
 assert.throws(()=>validateCourseFeed({...feed,courses:[{...course,endsAt:course.startsAt}]},7));
});
test("course range rejects invalid calendar dates and unbounded requests",()=>{
 assert.equal(courseAgendaRangeSchema.safeParse({from:"2026-11-01",to:"2026-11-30"}).success,true);
 for(const range of [{from:"2026-02-30",to:"2026-03-01"},{from:"2026-11-30",to:"2026-11-01"},{from:"2026-01-01",to:"2026-12-31"}])assert.equal(courseAgendaRangeSchema.safeParse(range).success,false);
});
test("course dates use Amsterdam daylight saving and split multi-day events without a midnight extra day",()=>{
 assert.equal(courseLocalDate("2026-07-01T22:30:00Z"),"2026-07-02");
 assert.equal(courseLocalDate("2026-11-01T22:30:00Z"),"2026-11-01");
 const days=courseOccurrences([{...course,startsAt:"2026-11-11T23:00:00Z",endsAt:"2026-11-13T23:00:00Z"}],"2026-11-01","2026-11-30");
 assert.deepEqual(days.map(d=>d.eventDate),["2026-11-12","2026-11-13"]);
 assert.equal(days[0].course.id,course.id);
 assert.deepEqual(courseOccurrences([course],"2026-12-01","2026-12-31"),[]);
 const clipped=courseOccurrences([{...course,startsAt:"2026-10-30T08:00:00Z",endsAt:"2026-11-02T15:00:00Z"}],"2026-11-01","2026-11-30");
 assert.deepEqual(clipped.map(d=>d.eventDate),["2026-11-01","2026-11-02"]);
});
