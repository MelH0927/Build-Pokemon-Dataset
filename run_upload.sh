: "${HF_TOKEN:?Set HF_TOKEN in your environment first, e.g. export HF_TOKEN=hf_...}"
cd "$(dirname "$0")"

#python upload_to_huggingface.py --dataset-path ./IVL_CLS_pokemon_8_shot --repo-name andyqmongo/IVL_CLS_pokemon_8_shot
#python upload_to_huggingface.py --dataset-path ./IVL_CLS_pokemon_4_shot --repo-name andyqmongo/IVL_CLS_pokemon_4_shot
#python upload_to_huggingface.py --dataset-path ./IVL_CLS_pokemon_2_shot --repo-name andyqmongo/IVL_CLS_pokemon_2_shot
#python upload_to_huggingface.py --dataset-path ./IVL_CLS_pokemon_1_shot --repo-name andyqmongo/IVL_CLS_pokemon_1_shot
#python upload_to_huggingface.py --dataset-path ./standard_eval_dataset --repo-name andyqmongo/pokemon_eval_standard
python upload_to_huggingface.py --dataset-path ./other_eval_dataset --repo-name andyqmongo/pokemon_eval_other