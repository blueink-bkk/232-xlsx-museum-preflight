drop view if exists pagex;

create or replace view tvec.pagex as
  select
    f.id,
    f.xid,
    f.path,
    f.filename,
    f.lang,
    p.pageno,
    p.data,
    p.raw_text
  from tvec.pages as p
  join tvec.files as f on (f.id = p.file_id)
  ;
