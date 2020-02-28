drop function if exists tvec.list_pages cascade;

create function tvec.list_pages(_path ltree, _filename varchar(500))
  returns jsonb as $$

declare
  retv jsonb;
  pages integer[];
  xid text;
  file_id_ integer;
  lang text;
begin
  select
  	into xid, lang, file_id_
	files.xid, files.lang, files.id
  from tvec.files where filename = _filename;

  pages := ARRAY(select pageno
  from tvec.pages, tvec.files
  where (id = file_id)
  and (path <@ _path)
  and (filename = _filename)
  );

  retv := json_build_object(
	  'lang', lang,
	  'filename',_filename,
	  'xid',xid,
	  'pages',pages,
	  'file_id', file_id_
  );
  return retv;
end

$$ language plpgsql;


-- select tvec.list_pages('museum.pdf','1908 Allez freres Section 1 20151026.pdf');
