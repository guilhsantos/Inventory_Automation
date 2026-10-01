


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."user_role" AS ENUM (
    'ADMIN',
    'OP_PRODUCAO',
    'OP_ESTOQUE'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."baixar_estoque_kit"("codigo_param" "text", "usuario_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 1. Diminui o estoque do Kit
  UPDATE kits 
  SET estoque_kits = estoque_kits - 1 
  WHERE codigo_unico = codigo_param AND estoque_kits > 0;

  -- 2. Registra quem fez a ação (Rastreabilidade)
  INSERT INTO movimentacoes (tipo, item_codigo, usuario_id, quantidade)
  VALUES ('SAIDA_KIT', codigo_param, usuario_id, 1);
END;
$$;


ALTER FUNCTION "public"."baixar_estoque_kit"("codigo_param" "text", "usuario_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_material_stock"("amount_kg" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Assume que só existe um registro de material ou ajusta para o ID específico
  UPDATE materials
  SET estoque_kg = estoque_kg - amount_kg
  WHERE id = (SELECT id FROM materials LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."decrement_material_stock"("amount_kg" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_entirely"("user_id_to_delete" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id_to_delete;
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
END;
$$;


ALTER FUNCTION "public"."delete_user_entirely"("user_id_to_delete" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  assigned_role text;
BEGIN
  -- Pega o role do metadado ou define o padrão
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'OP_ESTOQUE');

  -- Insere no profiles garantindo que o texto seja convertido para o tipo user_role
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    assigned_role::public.user_role -- O cast para o seu tipo ENUM
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_molde_stock"("row_id" bigint, "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE moldes
  SET estoque_atual = estoque_atual + amount
  WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_molde_stock"("row_id" bigint, "amount" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_production" (
    "id" bigint NOT NULL,
    "molde_id" bigint,
    "usuario_id" "uuid",
    "quantidade_boa" integer DEFAULT 0,
    "quantidade_defeito" integer DEFAULT 0,
    "sacos_usados" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "machine_id" bigint,
    "material_id" bigint
);


ALTER TABLE "public"."daily_production" OWNER TO "postgres";


COMMENT ON COLUMN "public"."daily_production"."material_id" IS 'Material (tipo) consumido nesta produção; linhas antigas ficam null.';



CREATE SEQUENCE IF NOT EXISTS "public"."daily_production_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."daily_production_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."daily_production_id_seq" OWNED BY "public"."daily_production"."id";



CREATE TABLE IF NOT EXISTS "public"."defects" (
    "id" bigint NOT NULL,
    "molde_id" bigint,
    "user_id" "uuid",
    "quantity" integer NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "machine_id" bigint NOT NULL
);


ALTER TABLE "public"."defects" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."defects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."defects_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."defects_id_seq" OWNED BY "public"."defects"."id";



CREATE TABLE IF NOT EXISTS "public"."kit_items" (
    "id" bigint NOT NULL,
    "kit_id" bigint,
    "molde_id" bigint,
    "quantidade" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."kit_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."kit_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."kit_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."kit_items_id_seq" OWNED BY "public"."kit_items"."id";



CREATE TABLE IF NOT EXISTS "public"."kits" (
    "id" integer NOT NULL,
    "codigo_unico" "text" NOT NULL,
    "nome_kit" "text" NOT NULL,
    "estoque_atual" integer DEFAULT 0
);


ALTER TABLE "public"."kits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."kits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."kits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."kits_id_seq" OWNED BY "public"."kits"."id";



CREATE TABLE IF NOT EXISTS "public"."machines" (
    "id" bigint NOT NULL,
    "nome" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'Ativa'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."machines" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."machines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."machines_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."machines_id_seq" OWNED BY "public"."machines"."id";



CREATE TABLE IF NOT EXISTS "public"."material_entries" (
    "id" bigint NOT NULL,
    "material_id" bigint,
    "quantidade_kg" numeric(10,2) NOT NULL,
    "data_chegada" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_entries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."material_entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."material_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."material_entries_id_seq" OWNED BY "public"."material_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" bigint NOT NULL,
    "nome" character varying(255) DEFAULT 'Material Padrão'::character varying NOT NULL,
    "estoque_kg" numeric(10,2) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."materials_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."materials_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."materials_id_seq" OWNED BY "public"."materials"."id";



CREATE TABLE IF NOT EXISTS "public"."moldes" (
    "id" bigint NOT NULL,
    "nome" character varying(255) NOT NULL,
    "peso_medio_kg" numeric(10,3) DEFAULT 0,
    "estoque_atual" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moldes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."moldes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."moldes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."moldes_id_seq" OWNED BY "public"."moldes"."id";



CREATE TABLE IF NOT EXISTS "public"."order_item_reservations" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "order_item_id" bigint NOT NULL,
    "kit_id" bigint NOT NULL,
    "qty_reserved" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "observation" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumed_by" "uuid",
    "consumed_at" timestamp with time zone,
    "reversed_by" "uuid",
    "reversed_at" timestamp with time zone,
    "reverse_reason" "text",
    CONSTRAINT "order_item_reservations_qty_reserved_check" CHECK (("qty_reserved" > 0)),
    CONSTRAINT "order_item_reservations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'reversed'::"text", 'consumed'::"text"])))
);


ALTER TABLE "public"."order_item_reservations" OWNER TO "postgres";


ALTER TABLE "public"."order_item_reservations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."order_item_reservations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" bigint NOT NULL,
    "order_id" bigint,
    "kit_id" bigint,
    "quantidade" integer DEFAULT 1 NOT NULL,
    "qty_reserved_total" integer DEFAULT 0 NOT NULL,
    "qty_consumed_total" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_items_id_seq" OWNED BY "public"."order_items"."id";



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" bigint NOT NULL,
    "codigo_unico" character varying(100) NOT NULL,
    "cliente" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'Pendente'::character varying,
    "data_entrega" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "invoice_number" "text",
    "notes" "text",
    "photo_url" "text",
    "is_priority" boolean DEFAULT false NOT NULL,
    "priority_position" integer DEFAULT 0 NOT NULL,
    "concluido_em" timestamp with time zone,
    "entregue_em" timestamp with time zone
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."concluido_em" IS 'Quando o pedido foi marcado Concluído (baixa com foto).';



COMMENT ON COLUMN "public"."orders"."entregue_em" IS 'Quando o pedido foi marcado Entregue (com NF).';



CREATE SEQUENCE IF NOT EXISTS "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."orders_id_seq" OWNED BY "public"."orders"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'OP_ESTOQUE'::"public"."user_role",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" bigint NOT NULL,
    "kit_id" bigint,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "movement_kind" "text",
    "order_id" bigint,
    "order_item_id" bigint,
    "reservation_id" bigint,
    "reversal_of_movement_id" bigint
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."stock_movements_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."stock_movements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."stock_movements_id_seq" OWNED BY "public"."stock_movements"."id";



ALTER TABLE ONLY "public"."daily_production" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."daily_production_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."defects" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."defects_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."kit_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."kit_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."kits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."kits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."machines" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."machines_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."material_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."material_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."materials" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."materials_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."moldes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."moldes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."orders" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."orders_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."stock_movements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stock_movements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."daily_production"
    ADD CONSTRAINT "daily_production_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."defects"
    ADD CONSTRAINT "defects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kit_items"
    ADD CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kits"
    ADD CONSTRAINT "kits_codigo_unico_key" UNIQUE ("codigo_unico");



ALTER TABLE ONLY "public"."kits"
    ADD CONSTRAINT "kits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machines"
    ADD CONSTRAINT "machines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_entries"
    ADD CONSTRAINT "material_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moldes"
    ADD CONSTRAINT "moldes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_codigo_unico_key" UNIQUE ("codigo_unico");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_order_item_reservations_item_status" ON "public"."order_item_reservations" USING "btree" ("order_item_id", "status");



CREATE INDEX "idx_order_item_reservations_order_status" ON "public"."order_item_reservations" USING "btree" ("order_id", "status");



CREATE INDEX "idx_stock_movements_order_created" ON "public"."stock_movements" USING "btree" ("order_id", "created_at");



ALTER TABLE ONLY "public"."daily_production"
    ADD CONSTRAINT "daily_production_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id");



ALTER TABLE ONLY "public"."daily_production"
    ADD CONSTRAINT "daily_production_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."daily_production"
    ADD CONSTRAINT "daily_production_molde_id_fkey" FOREIGN KEY ("molde_id") REFERENCES "public"."moldes"("id");



ALTER TABLE ONLY "public"."daily_production"
    ADD CONSTRAINT "daily_production_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."defects"
    ADD CONSTRAINT "defects_molde_id_fkey" FOREIGN KEY ("molde_id") REFERENCES "public"."moldes"("id");



ALTER TABLE ONLY "public"."defects"
    ADD CONSTRAINT "defects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."defects"
    ADD CONSTRAINT "fk_defects_machine" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kit_items"
    ADD CONSTRAINT "kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kit_items"
    ADD CONSTRAINT "kit_items_molde_id_fkey" FOREIGN KEY ("molde_id") REFERENCES "public"."moldes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_entries"
    ADD CONSTRAINT "material_entries_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id");



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_consumed_by_fkey" FOREIGN KEY ("consumed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id");



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_reservations"
    ADD CONSTRAINT "order_item_reservations_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."order_item_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_reversal_of_movement_id_fkey" FOREIGN KEY ("reversal_of_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."order_item_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_item_reservations_insert_auth" ON "public"."order_item_reservations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "order_item_reservations_select_auth" ON "public"."order_item_reservations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "order_item_reservations_update_auth" ON "public"."order_item_reservations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."baixar_estoque_kit"("codigo_param" "text", "usuario_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."baixar_estoque_kit"("codigo_param" "text", "usuario_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."baixar_estoque_kit"("codigo_param" "text", "usuario_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_material_stock"("amount_kg" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_material_stock"("amount_kg" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_material_stock"("amount_kg" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_entirely"("user_id_to_delete" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_entirely"("user_id_to_delete" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_entirely"("user_id_to_delete" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_molde_stock"("row_id" bigint, "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_molde_stock"("row_id" bigint, "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_molde_stock"("row_id" bigint, "amount" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."daily_production" TO "anon";
GRANT ALL ON TABLE "public"."daily_production" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_production" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_production_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_production_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_production_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."defects" TO "anon";
GRANT ALL ON TABLE "public"."defects" TO "authenticated";
GRANT ALL ON TABLE "public"."defects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."defects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."defects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."defects_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."kit_items" TO "anon";
GRANT ALL ON TABLE "public"."kit_items" TO "authenticated";
GRANT ALL ON TABLE "public"."kit_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kit_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kit_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kit_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."kits" TO "anon";
GRANT ALL ON TABLE "public"."kits" TO "authenticated";
GRANT ALL ON TABLE "public"."kits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."kits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."kits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."kits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."machines" TO "anon";
GRANT ALL ON TABLE "public"."machines" TO "authenticated";
GRANT ALL ON TABLE "public"."machines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."machines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."machines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."machines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."material_entries" TO "anon";
GRANT ALL ON TABLE "public"."material_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."material_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."material_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."material_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."material_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."materials_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."moldes" TO "anon";
GRANT ALL ON TABLE "public"."moldes" TO "authenticated";
GRANT ALL ON TABLE "public"."moldes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."moldes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."moldes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."moldes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_reservations" TO "anon";
GRANT ALL ON TABLE "public"."order_item_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_reservations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_item_reservations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_item_reservations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_item_reservations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stock_movements_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































