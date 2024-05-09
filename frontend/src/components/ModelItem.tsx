"use client";

import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";
import { useRouter } from "next/dist/client/components/navigation";
interface ModelItemProps {
  cover_image_url: string;
  name: string;
  owner: string;
  github: string;
  description: string;
}

export default function ModelItem({
  cover_image_url,
  name,
  owner,
  github,
  description
}: ModelItemProps) {
  const router = useRouter();

  const onClickGitHubHandle = () => {
    window.open(`${github}`, "_blank");
  };

  return (
    <div className="drop-shadow-[2px_2px_5px_rgba(0,0,0,0.16)] rounded-b-[7px] rounded-t-[7px] bg-slate-200 dark:bg-gray-800">
      <div className="relative z-0 flex flex-col ">
        <div
          className="cursor-pointer  w-full h-[320px] flex justify-center items-center"
          onClick={() =>
            router.push(`/modelDetail?owner=${owner}&name=${name}`)
          }
        >
          {cover_image_url ? (
            <Image
              src={cover_image_url}
              width={500}
              height={320}
              alt="Image"
              className="rounded-t-[7px] w-full h-[320px] object-cover"
            />
          ) : (
            <Image
              className="rounded-t-[7px] w-full  hidden"
              src={"/img/back-logo.png"}
              width={32}
              height={32}
              alt="Image"
            />
          )}
        </div>
        <div className="p-[12px]">
          <h4 className="left-[10px] max-w-full truncate  font-bold text-gray-800 text-[24px] w-[80%] dark:text-white">
            {owner}/{name}
          </h4>
          <p className="dark:text-white text-black mt-[15px]">
            {description}
          </p>
        </div>


        <div className="flex gap-x-[10px] items-center absolute  top-[338px] right-[10px]">
          <FaGithub
            className="text-gray-800 w-[20px] h-[20px] cursor-pointer dark:text-white"
            onClick={() => onClickGitHubHandle()}
          />
        </div>
      </div>
    </div>
  );
}
