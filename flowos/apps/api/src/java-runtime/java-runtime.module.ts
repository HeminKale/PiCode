import { Module } from "@nestjs/common";
import { JavaRuntimeService } from "./java-runtime.service";

@Module({ providers: [JavaRuntimeService], exports: [JavaRuntimeService] })
export class JavaRuntimeModule {}
