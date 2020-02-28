-- Feb 13, 2020
-- based on 2018/sql-project/repo2/create-table-pdf-files.sql
-- Why do we need data:jsonb in pdf-page ?
-- fiches musee => only 1 page en format yaml/MD
-- blueink co.th => fiches and pdf-files


create schema if not exists tvec;
create extension if not exists ltree;

create table if not exists tvec.files (
  id serial primary key,
  path ltree,      -- museum.pdf, jpc, blueink, etc....
  filename text not null, -- ex: 'https://www.costco.com/laptops
  lang text default 'fr',
  xid varchar(20), -- reference to an external ID
  unique (path, filename)
);

create table if not exists tvec.pages (
  file_id integer references tvec.files(id) on delete cascade,
  pageno integer not null,
  -- p2 : another ltree for url to avoid too many files... 
  -- ex: path: 'https://www.costco.com/
  --     cat: lg-gram-15-touchscreen-laptop---intel-core-i7---1080p.product
  --     .100408465.html'
  data jsonb, -- pour les fiches du musee et articles du dico.
  raw_text text,
  tsv tsvector,
  unique (file_id, pageno)
);


drop function if exists tvec.new_file cascade;

create function tvec.new_file(path ltree, filename text, lang text default 'fr'::text) returns integer
    LANGUAGE plpgsql
    AS $$
declare
	iret integer := -1;
	fn text := filename;
	_lang text := lang;
begin
	select id into iret
	from tvec.files as f where f.filename = fn;

	raise notice 'iret:%',iret;
	if iret is null then
		insert into tvec.files (path, filename, lang) values(path, fn,_lang) returning id into iret;
	end if;
raise notice 'iret2:%',iret;
return iret;
end;
$$;


drop function if exists tvec.write_page cascade;

create function tvec.write_page(_path text, filename text, _pageno integer, data jsonb, _raw_text text) returns void
    LANGUAGE plpgsql
    AS $$
declare
  _file_id integer;
  path ltree := _path;
--  _pageno integer := pageno;
--  _raw_text text := raw_text;
--  _data jsonb := data;
  _tsv tsvector;
begin
  if (filename is null) then
      raise exception 'Missing filename';
	else
	  _file_id := tvec.new_file(path, filename);
  end if;
  raise notice 'file-id:%', _file_id;

  --if (id is null) then
  --    raise exception 'Fatal error pdf file not found pdf:id:%',id;
  --end if;

  raise notice 'Processing raw_text for %::%', filename, _pageno;

  insert into tvec.pages (file_id, pageno, data, raw_text, tsv)
  select _file_id, _pageno, data, _raw_text, null;
  exception
  	when unique_violation then begin
		raise notice 'unique violation -> Updating instead:';
		update tvec.pages p
		set (raw_text, tsv) = (_raw_text,_tsv)
		where p.pageno = _pageno and p.file_id = _file_id;
	end;

end;
$$;


drop function if exists tvec.page_vector_update cascade;

create function tvec.page_vector_update() returns trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        new.tsv = to_tsvector('pg_catalog.french', COALESCE(NEW.raw_text, ''));
    END IF;
    IF TG_OP = 'UPDATE' THEN
        --IF NEW.raw_text <> OLD.raw_text THEN
            new.tsv = to_tsvector('pg_catalog.french', COALESCE(NEW.raw_text, ''));
        --END IF;
    END IF;
    RETURN NEW;
END
$$;

drop trigger if exists tsvector_update on tvec.pages;

create trigger tsvector_update BEFORE INSERT OR UPDATE ON tvec.pages FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger('tsv', 'pg_catalog.french', 'raw_text');


drop function if exists tvec.search_pages_rank_cd2 cascade;

create function tvec.search_pages_rank_cd2(
        in _path ltree,
        in _query text)
    returns table(
--      id integer,
--      tsv tsvector, -- do we need this ?
      rank real,
      fragments text,
      vpath ltree,      -- actual path where the page was found
      url text,         --
      pageno integer,   -- ignored for web-pages
      data jsonb        -- for external/client ID.
    ) LANGUAGE sql
    AS $$

	with X as ( select
    tsv,
    path,
		file_id,
    filename,
		pageNo,
    data,
		raw_text,
    ts_rank_cd(tsv,qqq) as rank
    from tvec.pages,
      tvec.files,
      to_tsquery('french', _query) as qqq
    where (files.id = file_id)
    and (path <@ _path) -- children
    and (tsv @@ qqq)
    ORDER BY rank DESC
    LIMIT 500
	)
	select -- in exact order "return as"
--    file_id,
--    tsv,
    rank,
    ts_headline('french', raw_text,
        to_tsquery('french', _query),
        'StartSel ="<em>", StopSel ="</em>", MaxWords = 50, MinWords = 19, HighlightAll = false, MaxFragments = 99, FragmentDelimiter = "\n<!>"')
       as fragments,
    path as vpath,
	  filename as url,
    pageno,
    data
	from X
--	join files on (X.file_id = files.id)
  order by rank desc, filename, pageno
$$;


drop function if exists tvec.remove_pages(ltree, text);

create or replace function tvec.remove_pages(_path ltree, _filename text) returns void as $$
declare
  _file_id integer;
begin
  select id into _file_id
  from tvec.files f where f.filename = _filename and f.path = _path;

  raise notice 'found file(%)(%)=>%',_path, _filename, _file_id;
  delete from tvec.pages where tvec.pages.file_id = _file_id;
end;
$$ language plpgsql;
